import { execSync } from "child_process";
import type { FixLoopResult } from "./types.js";

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Extract the first failing test summary line from vitest verbose output.
 * Vitest verbose format includes "FAIL  tests/path/to/file.test.ts" lines.
 */
function parseFailingSummary(output: string): string {
  const failLine = output.split("\n").find((line) => line.includes("FAIL "));
  if (failLine) return failLine.trim();
  // Fallback: first 200 chars of output
  return output.slice(0, 200);
}

/**
 * Extract the test file path from a FAIL summary line.
 */
function parseFailingTestName(summary: string): string {
  // Match "FAIL  tests/..." pattern
  const match = summary.match(/FAIL\s+(tests\/\S+)/);
  if (match) return match[1];
  // Fallback: the whole summary
  return summary.trim() || "unknown test";
}

/**
 * Extract a primary error message from vitest output.
 */
function parseErrorMessage(summary: string): string {
  // Look for "Error:" keyword
  const errorMatch = summary.match(/Error:\s+(.+)/);
  if (errorMatch) return errorMatch[1].trim();
  // Look for "expected" keyword (vitest assertion style)
  const expectedMatch = summary.match(/(expected\s+.+)/i);
  if (expectedMatch) return expectedMatch[1].trim();
  return summary.slice(0, 200).trim() || "unknown error";
}

/**
 * Analyze the pattern of failures across cycles and generate a hypothesis.
 * Per D-14: hypothesis is never empty — always provides a diagnostic direction.
 */
function generateHypothesis(attemptsLog: string[]): string {
  if (attemptsLog.length === 0) {
    return "No attempts recorded — fix loop exited before any cycles completed.";
  }

  // Extract test names from each attempt to check for pattern
  const testNames = attemptsLog.map((log) => parseFailingTestName(log));
  const uniqueTests = new Set(testNames);

  if (uniqueTests.size === 1) {
    return (
      "Same test failing across all cycles — likely a schema mismatch, " +
      "missing migration, or incorrect storage function return type."
    );
  }

  return (
    "Different tests failing across cycles — likely a cascading issue from " +
    "shared state or import error."
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Run a test glob through vitest, attempt fixes on failure, and escalate with
 * a structured report if tests still fail after MAX_CYCLES.
 *
 * Per D-10: max 3 cycles.
 * Per D-11: fixFn receives only the test output string — never modifies test files.
 * Per D-14: escalation report always includes all 4 required fields.
 *
 * @param options.projectRoot  - Absolute path to project root (cwd for execSync)
 * @param options.testGlob     - Glob pattern passed to "npx vitest run <glob>"
 * @param options.fixFn        - Called with (output, cycle) to attempt a fix;
 *                               returns true if a fix was applied, false to escalate early
 * @param options.maxCycles    - Override default of 3
 */
export async function runWithFixLoop(options: {
  projectRoot: string;
  testGlob: string;
  fixFn: (output: string, cycle: number) => Promise<boolean>;
  maxCycles?: number;
}): Promise<FixLoopResult> {
  const MAX_CYCLES = options.maxCycles ?? 3;
  const attemptsLog: string[] = [];

  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    let output = "";
    try {
      // Run vitest with the specific test glob
      output = execSync(
        `npx vitest run ${options.testGlob} --reporter=verbose`,
        {
          cwd: options.projectRoot,
          stdio: "pipe",
          encoding: "utf-8",
        }
      ) as unknown as string;

      // Tests passed — return immediately
      return {
        passed: true,
        cycles: cycle,
        lastOutput: output,
      };
    } catch (err: any) {
      // execSync throws on non-zero exit — capture stdout+stderr
      output = (err.stdout ?? "") + (err.stderr ?? "");
      const summary = parseFailingSummary(output);
      attemptsLog.push(`Cycle ${cycle}: ${summary}`);

      if (cycle < MAX_CYCLES) {
        // D-11: fixFn receives test output string — never test file paths
        const fixed = await options.fixFn(output, cycle);
        if (!fixed) {
          // Early escalation — fixFn signals it cannot fix the issue
          break;
        }
      }
    }
  }

  // All cycles exhausted (or early exit) — produce escalation report
  const lastLog = attemptsLog[attemptsLog.length - 1] ?? "";

  return {
    passed: false,
    cycles: attemptsLog.length,
    lastOutput: lastLog,
    escalationReport: {
      failingTest: parseFailingTestName(lastLog),
      errorMessage: parseErrorMessage(lastLog),
      attemptsLog,
      hypothesis: generateHypothesis(attemptsLog),
    },
  };
}
