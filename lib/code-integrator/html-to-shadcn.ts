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
3. Use lucide-react for icons in page content
4. TypeScript strict mode — all types must be explicit, default export required
5. 2-space indentation
6. NO data fetching: NO useQuery, NO useMutation, NO fetch(), NO axios, NO HTTP calls of any kind
7. Use static placeholder data (typed arrays/objects) where dynamic data would appear
8. Return ONLY the TypeScript file content — NO markdown fences, NO explanation, NO preamble
9. File will be named with kebab-case automatically — do NOT include filename in output`;

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
    max_tokens: 4096,
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

      return content;
    },
    { retries: 2, minTimeout: 1000, factor: 2 }
  );

  return {
    tsxContent,
    extractedImports: extractShadcnImports(tsxContent),
    layoutWrapped: tsxContent.includes("<Layout"),
  };
}
