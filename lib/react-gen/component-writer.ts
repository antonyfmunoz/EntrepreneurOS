// lib/react-gen/component-writer.ts
// Generates a single production-ready React/TypeScript page component using Claude.
// Validates output against design rules, retries on failure, runs design self-review.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";
import { DESIGN_RULES } from "./design-tokens.js";
import type { PageSpecFull } from "@shared/spec-schema.js";
import type { PageCopy } from "../copy-planner/types.js";
import type { ProjectBrief } from "../intake/types.js";

export interface ComponentWriterInput {
  page: PageSpecFull;
  pageCopy: PageCopy | null;
  designSystem: string;
  brandVoice: string;
  sharedComponentPaths: Record<string, string>;
  competitiveIntel?: string;
  priorPageSummary?: string;
  projectBrief: ProjectBrief;
  projectRoot: string;
}

export interface ComponentWriterOutput {
  pageName: string;
  filePath: string;
  componentCode: string;
  reviewScore: number;
  reviewFeedback: string[];
  passed: boolean;
  retried: boolean;
}

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

function toPascalCase(name: string): string {
  return name.replace(/(^|[\s-])(\w)/g, (_, _sep, ch) => ch.toUpperCase()).replace(/[\s-]/g, "");
}

// Known invalid lucide-react exports to catch in validation
const BANNED_IMPORTS = [
  /from\s+['"]next\//,
  /from\s+['"]@mui\//,
  /from\s+['"]@material/,
  /from\s+['"]material-ui/,
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateComponent(code: string): ValidationResult {
  const errors: string[] = [];

  if (!/export\s+default\s+function/.test(code)) {
    errors.push("Missing `export default function` declaration");
  }

  for (const pattern of BANNED_IMPORTS) {
    if (pattern.test(code)) {
      errors.push(`Contains banned import: ${pattern.source}`);
    }
  }

  if (/linear-gradient|radial-gradient/.test(code)) {
    errors.push("Contains CSS gradient — gradients are banned by design rules");
  }

  if (/#000000/.test(code) || /color:\s*['"]?black['"]?/.test(code)) {
    errors.push("Uses pure black (#000000 or 'black') — must use #2c2f30");
  }

  // Check file isn't truncated (common with long components)
  const trimmed = code.trim();
  if (!trimmed.endsWith("}") && !trimmed.endsWith("};")) {
    errors.push("File appears truncated — does not end with closing brace");
  }

  return { valid: errors.length === 0, errors };
}

function buildSystemPrompt(input: ComponentWriterInput): string {
  const parts = [
    "You are a world-class React/TypeScript developer and UI designer.",
    "You write production-quality, pixel-perfect React components.",
    "You follow design systems without deviation.",
    "",
    DESIGN_RULES,
  ];

  if (input.designSystem) {
    parts.push("", "DESIGN SYSTEM:", input.designSystem);
  }
  if (input.brandVoice) {
    parts.push("", "BRAND VOICE:", input.brandVoice);
  }
  if (input.competitiveIntel) {
    parts.push("", "COMPETITIVE INTELLIGENCE:", input.competitiveIntel);
  }

  return parts.join("\n");
}

function buildUserPrompt(input: ComponentWriterInput): string {
  const { page, pageCopy, sharedComponentPaths, priorPageSummary } = input;
  const componentName = toPascalCase(page.name);

  const sharedImports = Object.entries(sharedComponentPaths)
    .map(([name, filePath]) => `import { ${name} } from "${filePath}";`)
    .join("\n");

  const copySection = pageCopy
    ? `
EXACT COPY TO USE (do not invent your own):
- Heading: ${pageCopy.pageHeading}
- Subheading: ${pageCopy.pageSubheading ?? "(none)"}
- CTAs: ${pageCopy.ctas.map((c) => `${c.label} (${c.context})`).join(", ") || "(none)"}
- Empty state: ${pageCopy.emptyState}
- Placeholders: ${JSON.stringify(pageCopy.placeholders)}
- Helper text: ${JSON.stringify(pageCopy.helperText)}
- Error messages: ${JSON.stringify(pageCopy.errorMessages)}`
    : "";

  const priorContext = priorPageSummary
    ? `\nPRIOR PAGE CONTEXT (for visual consistency):\n${priorPageSummary}`
    : "";

  return `Write a complete, production-ready React/TypeScript component for this page.

PAGE SPEC:
${JSON.stringify(page, null, 2)}
${copySection}

SHARED COMPONENTS AVAILABLE:
${sharedImports || "(none built yet)"}
${priorContext}

REQUIREMENTS:
- Default export function named ${componentName}Page
- Use UniversalLayout for authenticated pages (auth pages are standalone)
- Use @tanstack/react-query for all data fetching
- Use wouter for routing/navigation
- Wire all API calls to real endpoints from the spec
- Loading: skeleton placeholders with shimmer
- Error: inline error message with retry button
- Empty: empty state from copy above
- Mobile responsive: works at 375px
- Complete file — no truncation, no TODOs, no placeholder comments
- All imports must resolve: react, lucide-react, @/components/ui/*, @/components/*, wouter, @tanstack/react-query

Return ONLY the TypeScript/React code. No markdown fences, no explanations.`;
}

async function selfReview(
  code: string,
  page: PageSpecFull,
): Promise<{ score: number; feedback: string[] }> {
  const client = getClient();

  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system:
      "You are a UI code reviewer. Score the component 0-1 against: design rules compliance, spec compliance, copy compliance, completeness. Return JSON only: { score: number, feedback: string[] }",
    messages: [
      {
        role: "user",
        content: `Review this React component for the "${page.name}" page.

DESIGN RULES:
${DESIGN_RULES}

PAGE SPEC:
${JSON.stringify({ name: page.name, purpose: page.purpose, components: page.components, authLevel: page.authLevel }, null, 2)}

COMPONENT CODE:
${code}

Return JSON only: { "score": 0.0-1.0, "feedback": ["issue1", "issue2"] }`,
      },
    ],
  });

  const msg = await stream.finalMessage();
  const text = msg.content[0];
  if (text.type !== "text") return { score: 0.5, feedback: ["Review failed — non-text response"] };

  try {
    const cleaned = text.text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as { score: number; feedback: string[] };
    return {
      score: Math.max(0, Math.min(1, parsed.score)),
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    };
  } catch {
    return { score: 0.5, feedback: ["Could not parse review response"] };
  }
}

export async function writeReactComponent(
  input: ComponentWriterInput,
): Promise<ComponentWriterOutput> {
  const client = getClient();
  const { page, projectRoot } = input;
  const kebabName = toKebabCase(page.name);
  const filePath = path.join(projectRoot, "client", "src", "pages", `${kebabName}-page.tsx`);

  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);

  async function generate(extraInstructions?: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: extraInstructions ? `${userPrompt}\n\nADDITIONAL REQUIREMENTS:\n${extraInstructions}` : userPrompt },
    ];

    const stream = client.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      system: systemPrompt,
      messages,
    });

    const msg = await stream.finalMessage();
    const text = msg.content[0];
    if (text.type !== "text") throw new Error("Non-text response from Claude");

    // Strip markdown fences if present
    return text.text
      .replace(/^```(?:tsx?|typescript|javascript)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();
  }

  // First attempt
  let code = await generate();
  let retried = false;

  // Validation pass
  const validation = validateComponent(code);
  if (!validation.valid) {
    retried = true;
    const errorList = validation.errors.map((e) => `- ${e}`).join("\n");
    code = await generate(`The previous attempt had these validation errors. Fix all of them:\n${errorList}`);
  }

  // Self-review
  const review = await selfReview(code, page);

  // If score too low and not already retried, regenerate
  if (review.score < 0.8 && !retried) {
    retried = true;
    const feedbackList = review.feedback.map((f) => `- ${f}`).join("\n");
    code = await generate(`The previous attempt scored ${review.score.toFixed(2)}. Fix these issues:\n${feedbackList}`);
    const secondReview = await selfReview(code, page);
    review.score = secondReview.score;
    review.feedback = secondReview.feedback;
  }

  // Write to disk
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, code, "utf-8");

  return {
    pageName: page.name,
    filePath,
    componentCode: code,
    reviewScore: review.score,
    reviewFeedback: review.feedback,
    passed: review.score >= 0.8,
    retried,
  };
}
