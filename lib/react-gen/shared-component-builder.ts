// lib/react-gen/shared-component-builder.ts
// Builds shared layout components before any pages. Sequential — each can
// import the previous. Written to disk immediately so downstream page
// generation can reference them.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";
import { DESIGN_RULES, DESIGN_TOKENS } from "./design-tokens.js";
import type { ProjectBrief } from "../intake/types.js";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
  });
}

interface SharedComponentDef {
  name: string;
  fileName: string;
  relativePath: string;
  description: string;
  dependsOn: string[];
}

const SHARED_COMPONENTS: SharedComponentDef[] = [
  {
    name: "designTokens",
    fileName: "design-tokens.ts",
    relativePath: "lib/design-tokens.ts",
    description:
      "CSS variable exports and utility constants matching the design system. Export colors, shadows, border-radius, and font as named constants. No React — pure TS constants file.",
    dependsOn: [],
  },
  {
    name: "AgentChatStub",
    fileName: "agent-chat-stub.tsx",
    relativePath: "components/agent-chat-stub.tsx",
    description:
      "Minimal chat interface component. Accepts onSendMessage callback, shows messages list. Glassmorphism card with input at bottom. Used as AI assistant panel across pages.",
    dependsOn: ["designTokens"],
  },
  {
    name: "FloatingAiPanel",
    fileName: "floating-ai-panel.tsx",
    relativePath: "components/floating-ai-panel.tsx",
    description:
      "Sticky top-center floating panel that collapses/expands on click. Contains AgentChatStub. Glassmorphism background, ambient shadow. Positioned fixed at top of viewport.",
    dependsOn: ["AgentChatStub"],
  },
  {
    name: "LeftRail",
    fileName: "left-rail.tsx",
    relativePath: "components/left-rail.tsx",
    description:
      "Navigation sidebar. Surface-container-low background (#eff1f2). No dividers between items. lucide-react icons. Active state uses primary color. Collapsible on mobile. Nav items passed as props.",
    dependsOn: ["designTokens"],
  },
  {
    name: "RightRail",
    fileName: "right-rail.tsx",
    relativePath: "components/right-rail.tsx",
    description:
      "Right-side AI assistant panel. Glassmorphism background. Contains AgentChatStub. Collapsible. Fixed width 320px on desktop, slides in as drawer on mobile.",
    dependsOn: ["AgentChatStub"],
  },
  {
    name: "Header",
    fileName: "header.tsx",
    relativePath: "components/header.tsx",
    description:
      "Top navbar with glassmorphism. Contains: logo/brand text on left, context switcher (company/project selector) in center, user avatar + notifications on right. Sticky top-0.",
    dependsOn: ["designTokens"],
  },
  {
    name: "UniversalLayout",
    fileName: "universal-layout.tsx",
    relativePath: "components/universal-layout.tsx",
    description:
      "Full page layout shell. Grid: Header (top, full width), LeftRail (left column), main content (center, scrollable), optional RightRail (right column). All authenticated pages wrap in this. Handles mobile responsive collapse.",
    dependsOn: ["Header", "LeftRail", "RightRail"],
  },
];

async function generateComponent(
  def: SharedComponentDef,
  projectBrief: ProjectBrief,
  existingComponents: Record<string, string>,
): Promise<string> {
  const client = getClient();

  const existingImports = def.dependsOn
    .filter((dep) => existingComponents[dep])
    .map((dep) => {
      const depDef = SHARED_COMPONENTS.find((c) => c.name === dep);
      if (!depDef) return "";
      const importPath = depDef.relativePath.startsWith("lib/")
        ? `@/${depDef.relativePath}`
        : `@/${depDef.relativePath}`;
      return `// Available: import from "${importPath}"`;
    })
    .join("\n");

  const tokensJson = JSON.stringify(DESIGN_TOKENS, null, 2);

  const stream = client.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system: `You are a world-class React/TypeScript developer. You write production-quality components for a SaaS application shell.

${DESIGN_RULES}

DESIGN TOKENS (use these exact values):
${tokensJson}

Product: ${projectBrief.productName}
${projectBrief.brandVoice ? `Brand voice: ${projectBrief.brandVoice.slice(0, 500)}` : ""}`,
    messages: [
      {
        role: "user",
        content: `Write a complete React/TypeScript component: ${def.name}

PURPOSE: ${def.description}

FILE PATH: client/src/${def.relativePath}

${existingImports ? `AVAILABLE IMPORTS FROM PRIOR COMPONENTS:\n${existingImports}\n` : ""}
REQUIREMENTS:
- Named export AND default export
- Full TypeScript types for all props
- lucide-react icons only
- shadcn/ui primitives where applicable (Button, Input, etc.)
- Mobile responsive
- No TODOs, no placeholder comments
- Complete file — no truncation

Return ONLY the TypeScript/React code. No markdown fences.`,
      },
    ],
  });

  const msg = await stream.finalMessage();
  const text = msg.content[0];
  if (text.type !== "text") throw new Error(`Non-text response generating ${def.name}`);

  return text.text
    .replace(/^```(?:tsx?|typescript|javascript)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

export async function buildSharedComponents(
  projectBrief: ProjectBrief,
  projectRoot: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const clientSrc = path.join(projectRoot, "client", "src");

  for (const def of SHARED_COMPONENTS) {
    const filePath = path.join(clientSrc, def.relativePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`  [react-gen] Building shared: ${def.name}...`);
    const code = await generateComponent(def, projectBrief, result);
    fs.writeFileSync(filePath, code, "utf-8");
    result[def.name] = filePath;
    console.log(`  \u2713 ${def.name}`);
  }

  return result;
}

export { SHARED_COMPONENTS };
