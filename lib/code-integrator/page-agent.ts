// lib/code-integrator/page-agent.ts
// Page-level sub-agent that translates an approved Stitch HTML page into a
// production React/TSX component. Designed to be spawned in parallel (one
// per page) via p-limit from integration-adapter.prepare().
//
// This is a "logical sub-agent" — one Anthropic API call per page, each
// running concurrently with the others. We use @anthropic-ai/sdk directly
// rather than @anthropic-ai/claude-agent-sdk because the latter requires
// zod@^4.0.0 which would break drizzle-zod + the rest of the v3 codebase.

import Anthropic from "@anthropic-ai/sdk";
import type { PageSpecFull } from "@shared/spec-schema.js";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";

export interface PageAgentInput {
  pageName: string;
  pageRoute: string;
  authLevel: PageSpecFull["authLevel"];
  htmlContent: string;
  pageSpec: PageSpecFull;
  designSystem: string;
  brandVoice: string | null;
  /** Shared layout component names available under @/components/layout/* */
  sharedComponents: string[];
  /** shadcn/ui components already installed in the project. */
  installedComponents: string[];
}

export interface PageAgentResult {
  pageName: string;
  tsxContent: string;
}

const SYSTEM_PROMPT = `You are a senior React engineer translating an approved Stitch-generated HTML page into a production React/TypeScript component.

The page must match the Ethereal Professional aesthetic defined in the DESIGN SYSTEM block — glassmorphism, purple accents, generous spacing, lucide icons, professional copy.

Rules (MUST follow all):
1. Stack: React + Vite + TypeScript strict + wouter + shadcn/ui + Tailwind + lucide-react.
2. Wrap the page in <UniversalLayout title="..."> from @/components/layout/universal-layout.
3. Use ONLY shadcn/ui components from the provided installed list — import from @/components/ui/<name>.
4. Use ONLY lucide-react icons. NEVER use Material Symbols names (SmartToy, ArrowForward, etc).
5. NO data fetching: no useQuery, useMutation, fetch(), axios. Static typed placeholder data only.
6. Internal links use wouter: import { Link } from "wouter".
7. NEVER import from "next/*".
8. Brand copy and voice must follow the BRAND VOICE block. Match the HTML's structure but rewrite any non-brand copy.
9. TypeScript strict — all props explicit, default export required, end with closing "}".
10. Output ONLY the .tsx file content. No markdown fences, no preamble, no explanation.`;

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

function stripMarkdownFences(content: string): string {
  return content
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

/**
 * Spawn a single page agent. Returns TSX content ready to be written to
 * client/src/pages/{kebab}-page.tsx. Caller is responsible for running this
 * inside a p-limit wrapper when batching multiple pages.
 */
export async function runPageAgent(
  input: PageAgentInput,
): Promise<PageAgentResult> {
  const userMessage = [
    `## PAGE`,
    `Name: ${input.pageName}`,
    `Route: ${input.pageRoute}`,
    `Auth level: ${input.authLevel}`,
    `Purpose: ${input.pageSpec.purpose ?? "(not specified)"}`,
    ``,
    `## SHARED LAYOUT COMPONENTS (available under @/components/layout/*)`,
    input.sharedComponents.join(", "),
    ``,
    `## INSTALLED shadcn/ui COMPONENTS (use only these — import from @/components/ui/*)`,
    input.installedComponents.join(", "),
    ``,
    `## DESIGN SYSTEM`,
    input.designSystem,
    ``,
    `## BRAND VOICE`,
    input.brandVoice ?? "(not specified — use neutral professional tone)",
    ``,
    `## APPROVED HTML (source of truth for layout & visuals)`,
    input.htmlContent,
    ``,
    `Return ONLY the .tsx file content.`,
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
    throw new Error(`page-agent[${input.pageName}]: no text response from Claude`);
  }

  const tsxContent = stripMarkdownFences(textBlock.text);
  if (!/export\s+default\s+function/.test(tsxContent)) {
    throw new Error(
      `page-agent[${input.pageName}]: output has no default export function`,
    );
  }

  return { pageName: input.pageName, tsxContent };
}
