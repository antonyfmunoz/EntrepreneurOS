import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOAuthState, readOAuthState, verifyOAuthState } from "../../server/integrations/gmail";

describe("Gmail OAuth state binding", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-characters"; });
  afterEach(() => { delete process.env.SESSION_SECRET; });

  it("accepts a current state only for the initiating local user", () => {
    const state = createOAuthState("owner-1", 1_000);
    expect(verifyOAuthState(state, "owner-1", 2_000)).toBe(true);
    expect(verifyOAuthState(state, "owner-2", 2_000)).toBe(false);
  });

  it("rejects expired or modified state", () => {
    const state = createOAuthState("owner-1", 1_000);
    expect(verifyOAuthState(state, "owner-1", 1_000 + 10 * 60_000 + 1)).toBe(false);
    expect(verifyOAuthState(`${state}modified`, "owner-1", 2_000)).toBe(false);
  });

  it("round-trips only allowlisted local return destinations", () => {
    const state = createOAuthState("owner-1", 1_000, "/company/12#systems");
    expect(readOAuthState(state, "owner-1", 2_000)?.returnTo).toBe("/company/12#systems");

    const external = createOAuthState("owner-1", 1_000, "https://attacker.example/collect");
    expect(readOAuthState(external, "owner-1", 2_000)?.returnTo).toBe("/portfolios");
  });
});
