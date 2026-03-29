import { z } from "zod";

// ─── SECTION 1: Test Run Result ───────────────────────────────────────────────

/**
 * Result from running a set of tests once via vitest.
 */
export const TestRunResultSchema = z.object({
  /** Whether all tests passed */
  passed: z.boolean(),
  /** Raw vitest output (stdout + stderr) */
  output: z.string(),
  /** List of failing test names/descriptions extracted from output */
  failingTests: z.array(z.string()),
});

export type TestRunResult = z.infer<typeof TestRunResultSchema>;

// ─── SECTION 2: Fix Attempt ───────────────────────────────────────────────────

/**
 * Record of a single fix attempt cycle in the fix loop.
 */
export const FixAttemptSchema = z.object({
  /** Which cycle this was (1-based) */
  cycle: z.number(),
  /** Vitest output for this cycle */
  output: z.string(),
  /** Whether the fixFn returned true (applied a fix) */
  fixApplied: z.boolean(),
});

export type FixAttempt = z.infer<typeof FixAttemptSchema>;

// ─── SECTION 3: Escalation Report ────────────────────────────────────────────

/**
 * Structured escalation report produced when fix loop exhausts all cycles
 * without achieving passing tests (D-14).
 */
export const EscalationReportSchema = z.object({
  /** The failing test name or file path */
  failingTest: z.string(),
  /** Primary error message extracted from vitest output */
  errorMessage: z.string(),
  /** Per-cycle summary log */
  attemptsLog: z.array(z.string()),
  /** AI-generated hypothesis about root cause — never empty */
  hypothesis: z.string(),
});

export type EscalationReport = z.infer<typeof EscalationReportSchema>;

// ─── SECTION 4: Fix Loop Result ───────────────────────────────────────────────

/**
 * Final result from the fix loop — either tests passed or escalation is needed.
 */
export const FixLoopResultSchema = z.object({
  /** Whether tests ultimately passed */
  passed: z.boolean(),
  /** How many cycles were completed */
  cycles: z.number(),
  /** Output from the final cycle */
  lastOutput: z.string(),
  /** Present only when passed=false and all cycles exhausted */
  escalationReport: EscalationReportSchema.optional(),
});

export type FixLoopResult = z.infer<typeof FixLoopResultSchema>;

// ─── SECTION 5: Test File Spec ────────────────────────────────────────────────

/**
 * A generated test file — its path and complete content as a string.
 */
export const TestFileSpecSchema = z.object({
  /** Relative file path from project root */
  filePath: z.string(),
  /** Complete file content as a string */
  content: z.string(),
});

export type TestFileSpec = z.infer<typeof TestFileSpecSchema>;
