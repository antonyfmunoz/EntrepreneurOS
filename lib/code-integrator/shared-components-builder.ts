// lib/code-integrator/shared-components-builder.ts
// Builds the 6 shared layout components (UniversalLayout, Header, LeftRail,
// RightRail, FloatingAIPanel, AgentChatStub) that page components depend on.
//
// Runs ONCE per integration phase, before any page-level sub-agents spawn.
// Idempotent — skips files that already exist so reruns don't clobber hand edits.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";

export const SHARED_LAYOUT_COMPONENTS = [
  {
    file: "universal-layout.tsx",
    name: "UniversalLayout",
    description:
      "Page shell: <Header /> on top, <LeftRail /> + {children} + <RightRail /> in a 3-column body, <FloatingAIPanel /> anchored bottom-right. Accepts `title?: string` and `children: React.ReactNode` props. Background uses the brand gradient from design-system.md.",
  },
  {
    file: "header.tsx",
    name: "Header",
    description:
      "Top bar: brand wordmark/logo on the left, page title (optional prop), user avatar + notifications bell on the right. Uses glassmorphism from design-system.md.",
  },
  {
    file: "left-rail.tsx",
    name: "LeftRail",
    description:
      "Vertical nav rail on the left. Uses wouter Link components. Nav items: Portfolio, Command Center, Org Chart, Agent Chat, Task Board, Workflows, Settings. Icons from lucide-react. Active route highlighted. No data fetching.",
  },
  {
    file: "right-rail.tsx",
    name: "RightRail",
    description:
      "Contextual sidebar on the right. Placeholder slot for page-specific panels. Takes optional `children?: React.ReactNode` for injection.",
  },
  {
    file: "floating-ai-panel.tsx",
    name: "FloatingAIPanel",
    description:
      "Floating AI assistant launcher, fixed bottom-right. Button opens a glassmorphic card anchored to the same corner. Renders <AgentChatStub /> inside the card when open. Uses React useState for open/closed.",
  },
  {
    file: "agent-chat-stub.tsx",
    name: "AgentChatStub",
    description:
      "Static chat UI scaffold — message list area with placeholder messages, a text input, send button. NO data fetching — pure presentational. Used inside FloatingAIPanel and potentially standalone on the AgentChat page.",
  },
] as const;

const SYSTEM_PROMPT = `You are a senior React engineer building layout primitives for a premium SaaS product.

Output ONE TypeScript React file per component, separated by a unique delimiter.
Use the format:

===FILE: <filename>===
<file contents>
===END===

Rules (MUST follow all):
1. React + Vite + TypeScript + wouter + lucide-react + shadcn/ui + Tailwind.
2. NEVER import from "next/*".
3. NO data fetching — no useQuery, useMutation, fetch(), axios. Static placeholder data only.
4. Use @/components/ui/* for shadcn primitives (button, card, avatar, input, etc.).
5. Default export each component by the exact name provided.
6. 2-space indentation, TypeScript strict mode, explicit prop types.
7. Apply the design system (glassmorphism, purple accents, generous spacing) from the DESIGN SYSTEM block below.
8. Apply the brand voice from the BRAND VOICE block for any visible copy.
9. Use lucide-react icons only (never Material Symbols names).
10. Internal links use wouter's <Link href="...">.
11. Components must compose cleanly — UniversalLayout imports the other layout components by name.

Output ONLY the file blocks. No preamble, no markdown fences, no explanation.`;

export interface BuildSharedComponentsInput {
  projectRoot: string;
  clientSrcPath: string;
  designSystem: string;
  brandVoice: string | null;
}

export interface BuildSharedComponentsResult {
  layoutDir: string;
  written: string[];
  skipped: string[];
}

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

function parseFileBlocks(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const re = /===FILE:\s*([\w.-]+)\s*===\s*\n([\s\S]*?)\n?===END===/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    result.set(match[1].trim(), match[2].trim());
  }
  return result;
}

/**
 * Build (or verify) the 6 shared layout components. Idempotent: if all files
 * already exist, returns immediately without an LLM call.
 */
export async function buildSharedComponents(
  input: BuildSharedComponentsInput,
): Promise<BuildSharedComponentsResult> {
  const layoutDir = path.join(
    input.projectRoot,
    input.clientSrcPath,
    "components",
    "layout",
  );
  fs.mkdirSync(layoutDir, { recursive: true });

  // Check which files already exist — we don't overwrite.
  const missing = SHARED_LAYOUT_COMPONENTS.filter(
    (c) => !fs.existsSync(path.join(layoutDir, c.file)),
  );
  const skipped = SHARED_LAYOUT_COMPONENTS.filter((c) =>
    fs.existsSync(path.join(layoutDir, c.file)),
  ).map((c) => c.file);

  if (missing.length === 0) {
    console.log(`[shared-components] All ${SHARED_LAYOUT_COMPONENTS.length} layout files already exist — skipping build.`);
    return { layoutDir, written: [], skipped };
  }

  console.log(`[shared-components] Building ${missing.length} missing layout component(s): ${missing.map((m) => m.name).join(", ")}`);

  const componentBrief = missing
    .map(
      (c, i) =>
        `${i + 1}. ${c.file} (default export: ${c.name})\n   ${c.description}`,
    )
    .join("\n\n");

  const userMessage = [
    "## DESIGN SYSTEM",
    input.designSystem,
    "",
    "## BRAND VOICE",
    input.brandVoice ?? "(not specified — use neutral, professional tone)",
    "",
    "## COMPONENTS TO BUILD",
    componentBrief,
    "",
    "Return one ===FILE:...===...===END=== block per component. Nothing else.",
  ].join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("shared-components-builder: no text response from Claude");
  }

  const blocks = parseFileBlocks(textBlock.text);
  if (blocks.size === 0) {
    throw new Error(
      "shared-components-builder: no file blocks parsed from response. Raw output:\n" +
        textBlock.text.slice(0, 500),
    );
  }

  const written: string[] = [];
  for (const comp of missing) {
    const content = blocks.get(comp.file);
    if (!content) {
      console.warn(`[shared-components] Missing block for ${comp.file} — skipping`);
      continue;
    }
    const target = path.join(layoutDir, comp.file);
    fs.writeFileSync(target, content + "\n", "utf-8");
    written.push(comp.file);
    console.log(`[shared-components] Wrote ${comp.file}`);
  }

  return { layoutDir, written, skipped };
}
