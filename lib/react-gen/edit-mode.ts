// lib/react-gen/edit-mode.ts
// Post-build editing: surgical, file-level component updates with instant Vite preview.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";
import { DESIGN_RULES } from "./design-tokens.js";
import type { ProjectBrief } from "../intake/types.js";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
  });
}

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export async function editPage(opts: {
  pageName: string;
  instruction: string;
  projectRoot: string;
  projectBrief: ProjectBrief;
}): Promise<void> {
  const { pageName, instruction, projectRoot, projectBrief } = opts;
  const kebabName = toKebabCase(pageName);
  const filePath = path.join(projectRoot, "client", "src", "pages", `${kebabName}-page.tsx`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Page file not found: ${filePath}. Check the page name and try again.`);
  }

  const currentCode = fs.readFileSync(filePath, "utf-8");
  const client = getClient();

  const systemParts = [
    "You are a world-class React/TypeScript developer editing an existing component.",
    "Preserve the overall structure and imports. Only change what the user asks for.",
    "Follow the design system without deviation.",
    "",
    DESIGN_RULES,
  ];

  if (projectBrief.designSystem) {
    systemParts.push("", "DESIGN SYSTEM:", projectBrief.designSystem.slice(0, 2000));
  }
  if (projectBrief.brandVoice) {
    systemParts.push("", "BRAND VOICE:", projectBrief.brandVoice.slice(0, 1000));
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    system: systemParts.join("\n"),
    messages: [
      {
        role: "user",
        content: `Edit this React component. Apply the requested change while keeping everything else intact.

CURRENT CODE:
${currentCode}

REQUESTED CHANGE:
${instruction}

Return the COMPLETE updated file. No markdown fences, no explanations. Only the code.`,
      },
    ],
  });

  const msg = await stream.finalMessage();
  const text = msg.content[0];
  if (text.type !== "text") throw new Error("Non-text response from Claude during edit");

  const updatedCode = text.text
    .replace(/^```(?:tsx?|typescript|javascript)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();

  fs.writeFileSync(filePath, updatedCode, "utf-8");
  console.log(`\u2713 Updated ${pageName} — Vite will hot-reload`);
}
