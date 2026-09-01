import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calendarWriteScopeCoverage, createOAuthState, readOAuthState, scopeCoverage, sendEmail, verifyOAuthState } from "../../server/integrations/gmail";

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

  it("does not represent read-only Gmail access as an authorized execution connection", () => {
    expect(scopeCoverage([
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ])).toEqual({ Gmail: false, Calendar: false, Drive: true });
    expect(scopeCoverage([
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ])).toEqual({ Gmail: true, Calendar: true, Drive: true });
    expect(calendarWriteScopeCoverage(["https://www.googleapis.com/auth/calendar.readonly"])).toBe(false);
    expect(calendarWriteScopeCoverage(["https://www.googleapis.com/auth/calendar.events"])).toBe(true);
  });

  it("does not require Calendar List authority for the events-only adapter", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(new URL("../../server/integrations/gmail.ts", import.meta.url), "utf8"),
    );
    expect(source).toContain('calendarId: "primary"');
    expect(source).toContain("events.list");
    expect(source).not.toContain("calendarList.list");
  });

  it("rejects email header injection before provider access", async () => {
    await expect(sendEmail("owner-1", { to: "safe@example.test", subject: "Hello\r\nBcc: attacker@example.test", body: "Safe body" })).rejects.toThrow("invalid line break");
  });
});
