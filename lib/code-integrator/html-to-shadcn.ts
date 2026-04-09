import Anthropic from "@anthropic-ai/sdk";
import pRetry from "p-retry";
import type { TranslationInput, TranslationResult } from "./types.js";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";

// ─── Anthropic client (lazy — instantiated once, same pattern as extract-tokens.ts) ──

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: getAnthropicApiKey(),
      baseURL: getAnthropicBaseUrl(),
    });
  }
  return _client;
}

// ─── Forbidden data-fetch patterns (D-04) ────────────────────────────────────

const DATA_FETCH_PATTERN = /useQuery|useMutation|fetch\(|axios\./;

// ─── System prompt ────────────────────────────────────────────────────────────

const TRANSLATION_SYSTEM_PROMPT = `You are a React component translator. Convert HTML to TypeScript React using shadcn/ui components.

Rules (MUST follow all):
1. Use ONLY components from the provided installed list — import from @/components/ui/[name]
2. Wrap the page in: import { Layout } from "@/components/layout"; — use <Layout title="PageName"> as the root
3. Use lucide-react for icons in page content. NEVER use Material Symbols names (e.g. "SmartToy", "ArrowForward", "KeyboardBackspace"). Use lucide names only (e.g. "Bot", "ArrowRight", "ArrowLeft").
4. TypeScript strict mode — all types must be explicit, default export required
5. 2-space indentation
6. NO data fetching: NO useQuery, NO useMutation, NO fetch(), NO axios, NO HTTP calls of any kind
7. Use static placeholder data (typed arrays/objects) where dynamic data would appear
8. Return ONLY the TypeScript file content — NO markdown fences, NO explanation, NO preamble
9. File will be named with kebab-case automatically — do NOT include filename in output
10. This is a React + Vite + wouter project — NOT Next.js. NEVER import from "next/*". For links use: import { Link } from "wouter";
11. For analytics, use "posthog-js" core — NEVER import from "posthog-js/react".
12. The component must be fully complete: end with a closing "}" for the exported function. Never truncate JSX.`;

// ─── Material Symbols → lucide-react name mapping ────────────────────────────
// Common icons the upstream HTML uses with Material Symbols names. The
// translator sometimes passes them through verbatim; we rewrite them to their
// lucide-react equivalents so the generated import resolves.
const ICON_NAME_MAP: Record<string, string> = {
  SmartToy: "Bot",
  ArrowForward: "ArrowRight",
  ArrowBack: "ArrowLeft",
  KeyboardBackspace: "ArrowLeft",
  KeyboardArrowRight: "ChevronRight",
  KeyboardArrowLeft: "ChevronLeft",
  KeyboardArrowDown: "ChevronDown",
  KeyboardArrowUp: "ChevronUp",
  ExpandMore: "ChevronDown",
  ExpandLess: "ChevronUp",
  Search: "Search",
  Home: "Home",
  Settings: "Settings",
  Person: "User",
  PersonOutline: "User",
  AccountCircle: "UserCircle",
  Menu: "Menu",
  Close: "X",
  Check: "Check",
  CheckCircle: "CheckCircle2",
  Cancel: "XCircle",
  Delete: "Trash2",
  Edit: "Pencil",
  Add: "Plus",
  Remove: "Minus",
  Visibility: "Eye",
  VisibilityOff: "EyeOff",
  Lock: "Lock",
  LockOpen: "Unlock",
  Notifications: "Bell",
  Email: "Mail",
  Phone: "Phone",
  Favorite: "Heart",
  Star: "Star",
  MoreVert: "MoreVertical",
  MoreHoriz: "MoreHorizontal",
  Logout: "LogOut",
  Login: "LogIn",
  Dashboard: "LayoutDashboard",
  BarChart: "BarChart3",
  ShowChart: "LineChart",
  PieChart: "PieChart",
  Refresh: "RefreshCw",
  Download: "Download",
  Upload: "Upload",
  Share: "Share2",
  Link: "Link",
  Warning: "AlertTriangle",
  Error: "AlertCircle",
  Info: "Info",
};

// ─── Framework-import sanitization (Bug 3) ───────────────────────────────────
function sanitizeFrameworkImports(content: string): string {
  let out = content;

  // next/link → wouter Link. Handles single- and multi-line import forms.
  out = out.replace(/from\s+["']next\/link["']/g, 'from "wouter"');
  // Strip any other next/* imports outright — this is a Vite project.
  out = out.replace(/^\s*import[^;]*from\s+["']next\/[^"']+["'];?\s*\n/gm, "");

  // posthog-js/react → posthog-js. The core package has no usePostHog /
  // PostHogProvider exports; the deploy phase handles provider wiring
  // separately, so we just drop the subpath.
  out = out.replace(/["']posthog-js\/react["']/g, '"posthog-js"');

  // Material Symbols → lucide-react name rewrite. Applied to the whole file
  // so both imports and JSX references are kept in sync.
  for (const [matName, lucideName] of Object.entries(ICON_NAME_MAP)) {
    if (matName === lucideName) continue;
    // Word-boundary replace, preserving identifier boundaries.
    const re = new RegExp(`\\b${matName}\\b`, "g");
    out = out.replace(re, lucideName);
  }

  return out;
}

// ─── Truncation detection (Bug 5) ────────────────────────────────────────────
function looksTruncated(content: string): boolean {
  if (!content || content.length < 40) return true;
  // Must have an exported default React component.
  if (!/export\s+default\s+function\s+\w+/.test(content)) return true;
  // Balanced braces is the cheapest reliable "did the model finish" check.
  let depth = 0;
  let inString: string | null = null;
  let prev = "";
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inString) {
      if (ch === inString && prev !== "\\") inString = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
    } else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    prev = ch;
  }
  if (depth !== 0) return true;
  // Last non-whitespace char should be "}" — closing the component function.
  const trimmed = content.trimEnd();
  return trimmed[trimmed.length - 1] !== "}";
}

// ─── Strip markdown fences if Claude wraps output ────────────────────────────

function stripMarkdownFences(content: string): string {
  return content
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

// ─── Extract shadcn component names from @/components/ui/* imports ────────────

function extractShadcnImports(tsxContent: string): string[] {
  const regex = /@\/components\/ui\/([\w-]+)/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(tsxContent)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

// ─── Build user message from TranslationInput ─────────────────────────────────

function buildUserMessage(input: TranslationInput): string {
  const componentList = input.installedComponents.join(", ");

  return [
    `## Page Details`,
    `Name: ${input.pageName}`,
    `Route: ${input.pageRoute}`,
    `Auth level: ${input.authLevel}`,
    ``,
    `## Installed shadcn/ui Components (use ONLY these)`,
    componentList,
    ``,
    `## Source HTML to Translate`,
    input.htmlContent,
  ].join("\n");
}

// ─── Core translation with data-fetch guard ───────────────────────────────────

async function doTranslate(
  input: TranslationInput,
  client: Anthropic,
  isRetryForDataFetch = false
): Promise<string> {
  const systemPrompt = isRetryForDataFetch
    ? TRANSLATION_SYSTEM_PROMPT +
      "\n\nCRITICAL: Your previous output contained data-fetching code. Remove ALL useQuery, useMutation, fetch(), and axios calls. Use static placeholder data instead."
    : TRANSLATION_SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    // Bug 5: page components can be large. 4096 tokens routinely truncated
    // dashboards mid-JSX. 8192 leaves headroom for continuation retries.
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: buildUserMessage(input),
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  return stripMarkdownFences(text);
}

// Bug 5: ask the model to continue a previously-truncated component.
async function continueTranslate(
  input: TranslationInput,
  client: Anthropic,
  partial: string
): Promise<string> {
  const tail = partial.slice(Math.max(0, partial.length - 200));
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    system:
      TRANSLATION_SYSTEM_PROMPT +
      "\n\nCRITICAL: Your previous output was truncated mid-component. Continue exactly from where you left off. Return ONLY the remaining content to append — no preamble, no repetition of earlier code. End with the closing '}' of the exported function.",
    messages: [
      { role: "user", content: buildUserMessage(input) },
      { role: "assistant", content: partial },
      {
        role: "user",
        content: `Your previous message ended with:\n\n${tail}\n\nContinue from that exact point and finish the component. Return only the remainder.`,
      },
    ],
  });
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return stripMarkdownFences(text);
}

// ─── translateHtmlToShadcn (exported) ─────────────────────────────────────────

export async function translateHtmlToShadcn(
  input: TranslationInput,
  client?: Anthropic
): Promise<TranslationResult> {
  const resolvedClient = client ?? getClient();

  const tsxContent = await pRetry(
    async () => {
      // First attempt
      let content = await doTranslate(input, resolvedClient, false);

      // Bug 5: detect mid-JSX truncation and ask the model to continue.
      // Max 2 continuation attempts before giving up loudly — the caller's
      // pRetry wrapper still gets another shot after the thrown error.
      let continuations = 0;
      while (looksTruncated(content) && continuations < 2) {
        const remainder = await continueTranslate(input, resolvedClient, content);
        content = content + "\n" + remainder;
        continuations++;
      }
      if (looksTruncated(content)) {
        throw new Error(
          "[html-to-shadcn] page generation truncated and continuation recovery failed"
        );
      }

      // Post-translation validation — data-fetch guard (Research Pitfall 2)
      if (DATA_FETCH_PATTERN.test(content)) {
        // One retry with stricter prompt
        content = await doTranslate(input, resolvedClient, true);

        // If still contains forbidden patterns, strip them with regex and warn
        if (DATA_FETCH_PATTERN.test(content)) {
          console.warn(
            "[html-to-shadcn] Data-fetching patterns found after retry — stripping automatically"
          );
          content = content
            .replace(/^import.*useQuery.*from.*;\n?/gm, "")
            .replace(/^import.*useMutation.*from.*;\n?/gm, "")
            .replace(/^import.*axios.*from.*;\n?/gm, "")
            .replace(/\buseQuery\s*\([^)]*\)[^;]*/g, "{ data: undefined, isLoading: false }")
            .replace(/\buseMutation\s*\([^)]*\)/g, "{ mutate: () => {} }")
            .replace(/\bfetch\s*\([^)]*\)/g, "Promise.resolve(null)")
            .replace(/\baxios\.[a-z]+\s*\([^)]*\)/g, "Promise.resolve(null)");
        }
      }

      // Bug 3: rewrite wrong-framework imports + Material Symbols icon names
      // after all content-quality retries, so the saved file is always clean.
      return sanitizeFrameworkImports(content);
    },
    { retries: 2, minTimeout: 1000, factor: 2 }
  );

  return {
    tsxContent,
    extractedImports: extractShadcnImports(tsxContent),
    layoutWrapped: tsxContent.includes("<Layout"),
  };
}
