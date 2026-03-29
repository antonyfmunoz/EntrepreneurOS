import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWithFixLoop } from "../../../lib/test-runner/fix-loop.js";

// Mock child_process so tests don't actually run vitest (D-11 compliance)
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";
const mockExecSync = vi.mocked(execSync);

describe("runWithFixLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns passed=true, cycles=1 when tests pass on first run", async () => {
    mockExecSync.mockReturnValue("All tests passed" as any);

    const result = await runWithFixLoop({
      projectRoot: "/test-project",
      testGlob: "tests/unit/**/*.test.ts",
      fixFn: async () => true,
    });

    expect(result.passed).toBe(true);
    expect(result.cycles).toBe(1);
    expect(result.escalationReport).toBeUndefined();
  });

  it("returns passed=false, cycles=3 with escalation report when tests fail 3 times", async () => {
    const failureError = {
      stdout: "FAIL  tests/unit/some.test.ts\n  Error: expected 1 to equal 2",
      stderr: "",
    };
    mockExecSync.mockImplementation(() => {
      throw failureError;
    });

    const fixFn = vi.fn().mockResolvedValue(true);

    const result = await runWithFixLoop({
      projectRoot: "/test-project",
      testGlob: "tests/unit/**/*.test.ts",
      fixFn,
    });

    expect(result.passed).toBe(false);
    expect(result.cycles).toBe(3);
    expect(result.escalationReport).toBeDefined();
    // All 4 required escalation fields must be present
    expect(result.escalationReport!.failingTest).toBeTruthy();
    expect(result.escalationReport!.errorMessage).toBeTruthy();
    expect(result.escalationReport!.attemptsLog).toHaveLength(3);
    expect(result.escalationReport!.hypothesis).toBeTruthy();
  });

  it("returns passed=true, cycles=2 when tests fail on cycle 1 then pass on cycle 2", async () => {
    const failureError = {
      stdout: "FAIL  tests/unit/some.test.ts\n  Error: mismatch",
      stderr: "",
    };
    // First call throws, second call succeeds
    mockExecSync
      .mockImplementationOnce(() => {
        throw failureError;
      })
      .mockReturnValueOnce("All tests passed" as any);

    const fixFn = vi.fn().mockResolvedValue(true);

    const result = await runWithFixLoop({
      projectRoot: "/test-project",
      testGlob: "tests/unit/**/*.test.ts",
      fixFn,
    });

    expect(result.passed).toBe(true);
    expect(result.cycles).toBe(2);
    expect(result.escalationReport).toBeUndefined();
  });

  it("escalates early when fixFn returns false", async () => {
    const failureError = {
      stdout: "FAIL  tests/unit/some.test.ts\n  Error: cannot fix this",
      stderr: "",
    };
    mockExecSync.mockImplementation(() => {
      throw failureError;
    });

    // fixFn signals it cannot apply a fix
    const fixFn = vi.fn().mockResolvedValue(false);

    const result = await runWithFixLoop({
      projectRoot: "/test-project",
      testGlob: "tests/unit/**/*.test.ts",
      fixFn,
    });

    expect(result.passed).toBe(false);
    // Should not reach MAX_CYCLES — escalated early after fixFn returned false
    expect(result.cycles).toBeLessThan(3);
    expect(result.escalationReport).toBeDefined();
  });

  it("escalation report hypothesis is never an empty string", async () => {
    const failureError = {
      stdout: "FAIL  tests/unit/some.test.ts\n  Error: unexpected",
      stderr: "",
    };
    mockExecSync.mockImplementation(() => {
      throw failureError;
    });

    const result = await runWithFixLoop({
      projectRoot: "/test-project",
      testGlob: "tests/unit/**/*.test.ts",
      fixFn: async () => true,
    });

    expect(result.escalationReport).toBeDefined();
    expect(result.escalationReport!.hypothesis).not.toBe("");
    expect(result.escalationReport!.hypothesis.length).toBeGreaterThan(0);
  });

  it("fixFn receives test output string — no test file paths passed (D-11)", async () => {
    const testOutput = "FAIL  tests/unit/some.test.ts\n  Error: assertion failed";
    const failureError = { stdout: testOutput, stderr: "" };
    mockExecSync
      .mockImplementationOnce(() => { throw failureError; })
      .mockReturnValueOnce("All tests passed" as any);

    let capturedOutput = "";
    const fixFn = vi.fn().mockImplementation(async (output: string) => {
      capturedOutput = output;
      return true;
    });

    await runWithFixLoop({
      projectRoot: "/test-project",
      testGlob: "tests/unit/**/*.test.ts",
      fixFn,
    });

    // fixFn receives the raw output string — no implementation file paths mixed in
    expect(typeof capturedOutput).toBe("string");
    expect(capturedOutput).toContain("FAIL");
    // The output should NOT be a file path — D-11: fixFn fixes implementation, never tests
    expect(capturedOutput).not.toMatch(/^\/[^/]/); // not a file path
  });
});
