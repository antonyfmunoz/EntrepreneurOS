// lib/agents/qa-agent.ts
// QA agent — validates the entire project after all other agents complete.
// Runs tsc, import validation, null-safety scans, and state-pattern checks
// on every generated page. Attempts auto-fix via Claude for fixable issues.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey, getAnthropicBaseUrl } from "../env.js";
import {
  runTscCheck,
  validateImports,
  scanForNullUnsafePatterns,
  autoFixImports,
} from "../react-gen/component-writer.js";
import { ArtifactStore } from "./artifact-store.js";
import type { QAReport, QAIssue, PageOutput } from "./types.js";

const SYSTEM_PROMPT =
  "You are a senior QA engineer and code reviewer. You never sign off on broken work. You fix issues precisely and minimally.";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: getAnthropicApiKey(),
    baseURL: getAnthropicBaseUrl(),
  });
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:tsx?|typescript|javascript)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

function parseTscErrors(errors: string[]): QAIssue[] {
  return errors.map((msg) => {
    const fileMatch = msg.match(/^([^(]+)\((\d+),/);
    return {
      file: fileMatch ? fileMatch[1].trim() : "unknown",
      line: fileMatch ? parseInt(fileMatch[2], 10) : undefined,
      severity: "error" as const,
      category: "typescript" as const,
      message: msg,
      autoFixed: false,
    };
  });
}

function checkStatePatterns(code: string): string[] {
  const missing: string[] = [];
  const hasLoading = /isLoading|loading|skeleton|Skeleton/i.test(code);
  const hasError = /error|Error|retry|Retry/i.test(code);
  const hasEmpty = /empty|no\s+\w+\s+found|nothing|no\s+results|emptyState/i.test(code);

  if (!hasLoading) missing.push("Missing loading/skeleton state");
  if (!hasError) missing.push("Missing error/retry state");
  if (!hasEmpty) missing.push("Missing empty state");

  return missing;
}

async function attemptAutoFix(
  client: Anthropic,
  filePath: string,
  issue: QAIssue,
  fileContent: string,
): Promise<string | null> {
  try {
    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Fix this ${issue.category} error in the file below. Return ONLY the complete fixed file — no explanations, no markdown fences.

ERROR:
${issue.message}

FILE (${filePath}):
${fileContent}`,
        },
      ],
    });

    const msg = await stream.finalMessage();
    const text = msg.content[0];
    if (text.type !== "text") return null;
    return stripFences(text.text);
  } catch {
    return null;
  }
}

export async function runQAAgent(store: ArtifactStore): Promise<QAReport> {
  const projectRoot = store.getProjectRoot();
  const pageOutputs = store.getPageOutputs() ?? [];
  const architecture = store.getArchitecture();
  const backendRoutes = store.getBackendRoutes() ?? [];
  const client = getClient();

  const allIssues: QAIssue[] = [];
  const pageResultsMap = new Map<string, QAIssue[]>();

  // Initialize per-page issue tracking
  for (const page of pageOutputs) {
    pageResultsMap.set(page.pageName, []);
  }

  // Step 1: Full project tsc check (no scope)
  let tscResult = runTscCheck(projectRoot);
  const tscIssues = parseTscErrors(tscResult.errors);
  allIssues.push(...tscIssues);

  // Assign tsc errors to pages where possible
  for (const issue of tscIssues) {
    for (const page of pageOutputs) {
      const normalizedIssue = issue.file.replace(/\\/g, "/");
      const normalizedPage = page.filePath.replace(/\\/g, "/");
      if (normalizedIssue.includes(normalizedPage) || normalizedPage.includes(normalizedIssue)) {
        const pageIssues = pageResultsMap.get(page.pageName) ?? [];
        pageIssues.push(issue);
        pageResultsMap.set(page.pageName, pageIssues);
      }
    }
  }

  // Step 2: Per-page validation
  for (const page of pageOutputs) {
    const fullPath = path.isAbsolute(page.filePath)
      ? page.filePath
      : path.join(projectRoot, page.filePath);

    if (!fs.existsSync(fullPath)) continue;

    const code = fs.readFileSync(fullPath, "utf-8");
    const pageIssues = pageResultsMap.get(page.pageName) ?? [];

    // Import validation
    const importCheck = validateImports(code);
    for (const violation of importCheck.violations) {
      const issue: QAIssue = {
        file: fullPath,
        severity: "error",
        category: "import",
        message: `Forbidden import: ${violation}`,
        autoFixed: false,
      };
      allIssues.push(issue);
      pageIssues.push(issue);
    }

    // Null safety scan
    const nullIssues = scanForNullUnsafePatterns(code);
    for (const msg of nullIssues) {
      const lineMatch = msg.match(/^Line (\d+):/);
      const issue: QAIssue = {
        file: fullPath,
        line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
        severity: "warning",
        category: "null-safety",
        message: msg,
        autoFixed: false,
      };
      allIssues.push(issue);
      pageIssues.push(issue);
    }

    // State pattern check
    const stateMissing = checkStatePatterns(code);
    for (const msg of stateMissing) {
      const issue: QAIssue = {
        file: fullPath,
        severity: "warning",
        category: "state",
        message: msg,
        autoFixed: false,
      };
      allIssues.push(issue);
      pageIssues.push(issue);
    }

    pageResultsMap.set(page.pageName, pageIssues);
  }

  // Step 3: Auto-fix loop (max 3 iterations)
  let iterations = 0;
  const fixableCategories = new Set<QAIssue["category"]>(["typescript", "import", "null-safety"]);

  while (iterations < 3) {
    const unfixed = allIssues.filter((i) => !i.autoFixed && fixableCategories.has(i.category));
    if (unfixed.length === 0) break;

    iterations++;

    // Group issues by file for efficient fixing
    const issuesByFile = new Map<string, QAIssue[]>();
    for (const issue of unfixed) {
      const existing = issuesByFile.get(issue.file) ?? [];
      existing.push(issue);
      issuesByFile.set(issue.file, existing);
    }

    for (const [filePath, fileIssues] of issuesByFile) {
      if (!fs.existsSync(filePath)) continue;

      let code = fs.readFileSync(filePath, "utf-8");

      // Build a combined error message for all issues in this file
      const combinedMessage = fileIssues.map((i) => i.message).join("\n");
      const combinedIssue: QAIssue = {
        file: filePath,
        severity: "error",
        category: fileIssues[0].category,
        message: combinedMessage,
        autoFixed: false,
      };

      const fixed = await attemptAutoFix(client, filePath, combinedIssue, code);
      if (fixed) {
        // Apply auto-fix for known bad imports before writing
        const finalCode = autoFixImports(fixed);
        fs.writeFileSync(filePath, finalCode, "utf-8");

        // Mark all issues for this file as auto-fixed
        for (const issue of fileIssues) {
          issue.autoFixed = true;
        }
      }
    }

    // Re-run tsc to check if fixes resolved the errors
    tscResult = runTscCheck(projectRoot);
    if (tscResult.clean) break;

    // Add any new tsc errors that appeared after fixes
    const newTscIssues = parseTscErrors(tscResult.errors);
    for (const newIssue of newTscIssues) {
      const alreadyTracked = allIssues.some(
        (existing) =>
          existing.category === "typescript" &&
          existing.message === newIssue.message &&
          existing.file === newIssue.file,
      );
      if (!alreadyTracked) {
        allIssues.push(newIssue);
      }
    }
  }

  // Step 4: Build QA report
  const issuesFixed = allIssues.filter((i) => i.autoFixed).length;
  const remainingIssues = allIssues.filter((i) => !i.autoFixed);
  const tscClean = tscResult.clean;

  const pageResults = pageOutputs.map((page) => {
    const issues = pageResultsMap.get(page.pageName) ?? [];
    const hasUnfixed = issues.some((i) => !i.autoFixed);
    return {
      pageName: page.pageName,
      passed: !hasUnfixed,
      issues,
    };
  });

  const report: QAReport = {
    allPassed: tscClean && remainingIssues.length === 0,
    totalIssues: allIssues.length,
    issuesFixed,
    remainingIssues,
    iterations,
    tscClean,
    pageResults,
  };

  // Step 5: Persist report
  store.setQAReport(report);

  return report;
}
