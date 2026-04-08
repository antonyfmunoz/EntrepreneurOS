import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";

/**
 * Code-review and simplify skill wrappers (Plan 04-04).
 *
 * Both functions invoke the Anthropic API with skill-aware prompts. Fail-open:
 * any error returns null and the pipeline continues.
 */

const MODEL = "claude-sonnet-4-5";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
  });
}

async function callSkill(content: string, maxTokens = 1024): Promise<string | null> {
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    });
    const block = response.content[0];
    return block && block.type === "text" ? block.text : null;
  } catch (err) {
    console.warn("[skill-reviews] unavailable:", (err as Error).message);
    return null;
  }
}

/**
 * Apply the code-review:code-review skill heuristics to a code snippet.
 */
export async function queryCodeReviewSkill(code: string): Promise<string | null> {
  return callSkill(
    `Apply the code-review:code-review skill to this code. Identify quality issues, security concerns, and maintainability problems. Be concrete, no preamble.\n\n${code}`
  );
}

/**
 * Apply the simplify skill heuristics to a code snippet.
 */
export async function querySimplifySkill(code: string): Promise<string | null> {
  return callSkill(
    `Apply the simplify skill to this code. Identify refactoring opportunities and dead code that can be removed without changing behaviour.\n\n${code}`
  );
}

export interface VerificationInput {
  pageFile: string;
  routePath: string;
  componentsUsed: string[];
}

export interface VerificationResult {
  passed: boolean;
  issues: string[];
}

/**
 * Apply the superpowers:verification-before-completion checklist.
 * Returns a structured pass/fail with any issues surfaced.
 */
export async function queryVerificationSkill(
  input: VerificationInput
): Promise<VerificationResult> {
  const text = await callSkill(
    `Apply the superpowers:verification-before-completion skill. Check if this page integration is ready to ship.

File: ${input.pageFile}
Route: ${input.routePath}
Components: ${input.componentsUsed.join(", ")}

Reply in this format:
STATUS: PASS or FAIL
ISSUES: one issue per line, or "none"`,
    512
  );

  if (!text) return { passed: true, issues: [] };

  const statusMatch = text.match(/STATUS:\s*(PASS|FAIL)/i);
  const passed = statusMatch?.[1]?.toUpperCase() !== "FAIL";

  const issuesMatch = text.match(/ISSUES:\s*([\s\S]*)/i);
  const rawIssues = issuesMatch?.[1]?.trim() ?? "";
  const issues =
    /^none$/i.test(rawIssues)
      ? []
      : rawIssues
          .split("\n")
          .map((l) => l.replace(/^[-*]\s*/, "").trim())
          .filter((l) => l.length > 0);

  return { passed, issues };
}
