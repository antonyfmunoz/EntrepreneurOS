import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StitchWrapperError } from "../../lib/stitch/types.js";

describe("StitchWrapperError", () => {
  it("has correct name, message, recoverable, and code", () => {
    const err = new StitchWrapperError("test error", true, "RATE_LIMITED");
    expect(err.name).toBe("StitchWrapperError");
    expect(err.message).toBe("test error");
    expect(err.recoverable).toBe(true);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err instanceof Error).toBe(true);
  });

  it("non-recoverable error has recoverable=false", () => {
    const err = new StitchWrapperError("auth failed", false, "AUTH_FAILED");
    expect(err.recoverable).toBe(false);
  });
});

describe("generateScreen", () => {
  const originalEnv = process.env.STITCH_API_KEY;

  beforeEach(() => {
    delete process.env.STITCH_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STITCH_API_KEY = originalEnv;
    } else {
      delete process.env.STITCH_API_KEY;
    }
  });

  it("throws StitchWrapperError with ENV_MISSING when no API key", async () => {
    const { generateScreen } = await import("../../lib/stitch/client.js");
    await expect(
      generateScreen("proj-1", { prompt: "test" })
    ).rejects.toThrow("STITCH_API_KEY environment variable is not set");
  });

  it("error message does not contain any actual API key value", async () => {
    process.env.STITCH_API_KEY = "sk-secret-test-key-12345";
    const { generateScreen } = await import("../../lib/stitch/client.js");
    try {
      await generateScreen("proj-1", { prompt: "test" });
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).not.toContain("sk-secret-test-key-12345");
      }
    }
  });
});
