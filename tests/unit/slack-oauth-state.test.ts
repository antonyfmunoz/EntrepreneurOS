import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOAuthState, getAuthUrl, readOAuthState } from "../../server/integrations/slack";

describe("Slack OAuth state binding", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-characters";
    process.env.SLACK_CLIENT_ID = "slack-client-id";
    process.env.SLACK_CLIENT_SECRET = "slack-client-secret";
    process.env.SLACK_REDIRECT_URI = "https://entrepreneuros.net/api/auth/slack/callback";
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
    delete process.env.SLACK_REDIRECT_URI;
  });

  it("binds the company workspace authorization to the initiating EOS user", async () => {
    const state = await createOAuthState("owner-1", 1_000, "/company/12#systems");
    expect((await readOAuthState(state, "owner-1", 2_000))?.returnTo).toBe("/company/12#systems");
    expect(await readOAuthState(state, "owner-2", 2_000)).toBeNull();
  });

  it("rejects expired, modified, and external-return states", async () => {
    const state = await createOAuthState("owner-1", 1_000, "https://attacker.example/collect");
    expect((await readOAuthState(state, "owner-1", 2_000))?.returnTo).toBe("/portfolios");
    expect(await readOAuthState(state, "owner-1", 1_000 + 10 * 60_000 + 1)).toBeNull();
    expect(await readOAuthState(`${state}modified`, "owner-1", 2_000)).toBeNull();
  });

  it("requests only the bounded company-bot scopes", async () => {
    const url = new URL(await getAuthUrl("owner-1", "/company/12#systems"));
    expect(url.origin).toBe("https://slack.com");
    expect(url.pathname).toBe("/oauth/v2/authorize");
    expect(url.searchParams.get("scope")).toBe("chat:write,channels:read,groups:read");
    expect(url.searchParams.get("redirect_uri")).toBe("https://entrepreneuros.net/api/auth/slack/callback");
    expect(await readOAuthState(url.searchParams.get("state")!, "owner-1")).not.toBeNull();
  });
});
