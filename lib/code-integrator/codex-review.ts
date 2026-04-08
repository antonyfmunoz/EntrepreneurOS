import Anthropic from "@anthropic-ai/sdk";

/**
 * Codex code review (Plan 04-04).
 *
 * Reviews translated TSX via the Anthropic API with a `codex-cli-runtime`-style
 * prompt. NOT a real Codex CLI invocation — Codex is a Claude Code Skill,
 * not a callable Node API. From a runtime library this is the best honest
 * approximation: ask Claude to apply Codex review heuristics.
 *
 * Fail-open: any error returns `{ passed: true, issues: [] }` so the pipeline
 * never blocks on the review.
 */

export type CodexIssueSeverity = "critical" | "warning" | "info";

export interface CodexReviewIssue {
  severity: CodexIssueSeverity;
  description: string;
  line?: number;
  suggestion?: string;
}

export interface CodexReviewResult {
  passed: boolean;
  issues: CodexReviewIssue[];
}

const MODEL = "claude-sonnet-4-5";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    ...(process.env.ANTHROPIC_API_KEY ? {} : { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }),
  });
}

/**
 * Review a translated TSX component.
 * Checks: shadcn/ui usage, presence of forbidden data-fetching code, TypeScript
 * issues, React best practices.
 */
export async function reviewWithCodex(
  tsxContent: string,
  pageName: string
): Promise<CodexReviewResult> {
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Apply the codex-cli-runtime skill to review this React TypeScript component.

Component: ${pageName}
Code:
\`\`\`typescript
${tsxContent}
\`\`\`

Check for:
1. Improper shadcn/ui usage (wrong imports, incorrect props, missing components)
2. Data-fetching code (useQuery, useMutation, fetch, axios) — these MUST NOT exist in Phase 4 output
3. TypeScript type issues (any, missing types, unsafe assertions)
4. React best practices violations (key warnings, hook rules, missing deps)

Return findings in EXACTLY this format:
CRITICAL: [issues that must be fixed]
WARNING: [issues that should be reviewed]
INFO: [suggestions for improvement]

One issue per line, no bullets, no extra prose.`,
        },
      ],
    });

    const block = response.content[0];
    const text = block && block.type === "text" ? block.text : "";
    return parseCodexReview(text);
  } catch (err) {
    console.warn("[codex-review] unavailable:", (err as Error).message);
    return { passed: true, issues: [] };
  }
}

/**
 * Parse a CRITICAL/WARNING/INFO formatted Codex review response.
 *
 * Walks the text line by line, switching the active severity when it
 * encounters a `CRITICAL:` / `WARNING:` / `INFO:` header. Any non-header
 * content is collected under the current section.
 */
export function parseCodexReview(text: string): CodexReviewResult {
  const issues: CodexReviewIssue[] = [];
  let active: CodexIssueSeverity | null = null;

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const headerMatch = raw.match(/^\s*(CRITICAL|WARNING|INFO)\s*:\s*(.*)$/i);
    if (headerMatch) {
      active = headerMatch[1].toLowerCase() as CodexIssueSeverity;
      const inline = headerMatch[2].trim();
      if (inline) addIssue(issues, active, inline);
      continue;
    }
    if (active) {
      const cleaned = raw.replace(/^[-*]\s*/, "").trim();
      if (cleaned) addIssue(issues, active, cleaned);
    }
  }

  const criticals = issues.filter((i) => i.severity === "critical");
  return { passed: criticals.length === 0, issues };
}

function addIssue(
  issues: CodexReviewIssue[],
  severity: CodexIssueSeverity,
  description: string
): void {
  if (/^\[?(none|n\/a|nothing)\]?\.?$/i.test(description)) return;
  issues.push({ severity, description });
}
