import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauthStore = vi.hoisted(() => ({ getOauthToken: vi.fn(), upsertOauthToken: vi.fn(), deleteOauthToken: vi.fn() }));
vi.mock("../../server/storage", () => ({ storage: oauthStore }));

import { encryptCredential } from "../../server/security/credential-encryption";
import { connectionSummary, createOAuthState, disconnect, getAuthUrl, readOAuthState, verifyConnection } from "../../server/integrations/slack";

describe("Slack company OAuth", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-characters";
    process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 14).toString("base64");
    process.env.SLACK_CLIENT_ID = "slack-client-id";
    process.env.SLACK_CLIENT_SECRET = "slack-client-secret";
    process.env.SLACK_REDIRECT_URI = "https://entrepreneuros.net/api/auth/slack/callback";
    for (const mock of Object.values(oauthStore)) mock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const key of ["SESSION_SECRET", "EOS_CREDENTIAL_ENCRYPTION_KEY", "SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_REDIRECT_URI"]) delete process.env[key];
    vi.unstubAllGlobals();
  });

  it("binds OAuth state to the initiating user and a local company route", () => {
    const state = createOAuthState("owner-1", 1_000, "/company/12#systems");
    expect(readOAuthState(state, "owner-1", 2_000)?.returnTo).toBe("/company/12#systems");
    expect(readOAuthState(state, "owner-2", 2_000)).toBeNull();
    expect(readOAuthState(state, "owner-1", 601_001)).toBeNull();
    expect(readOAuthState(createOAuthState("owner-1", 1_000, "https://attacker.example"), "owner-1", 2_000)?.returnTo).toBe("/portfolios");
  });

  it("requests only the company bot scopes and never exposes its secret", () => {
    const url = new URL(getAuthUrl("owner-1", "/company/12#systems"));
    expect(`${url.origin}${url.pathname}`).toBe("https://slack.com/oauth/v2/authorize");
    expect(url.searchParams.get("client_id")).toBe("slack-client-id");
    expect(url.searchParams.get("scope")).toBe("chat:write,channels:read,groups:read");
    expect(url.searchParams.get("redirect_uri")).toBe(process.env.SLACK_REDIRECT_URI);
    expect(url.toString()).not.toContain("slack-client-secret");
  });

  it("verifies the exact installed workspace with the encrypted bot token", async () => {
    oauthStore.getOauthToken.mockResolvedValue({ accessToken: encryptCredential("xoxb-safe-token"), metadata: { teamId: "T0TEST", teamName: "Empyrean Studios" } });
    const providerFetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer xoxb-safe-token");
      return new Response(JSON.stringify({ ok: true, team_id: "T0TEST", team: "Empyrean Studios", user_id: "UBOT" }), { status: 200 });
    });
    vi.stubGlobal("fetch", providerFetch);
    await expect(verifyConnection("owner-1")).resolves.toMatchObject({ connected: true, healthy: true, workspace: { teamId: "T0TEST", teamName: "Empyrean Studios" } });
    expect(oauthStore.upsertOauthToken).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner-1", provider: "slack" }));
  });

  it("does not represent another person's workspace as connected and removes local material on disconnect", async () => {
    oauthStore.getOauthToken.mockImplementation(async (userId: string) => userId === "owner-1" ? { accessToken: encryptCredential("xoxb-safe-token"), metadata: { teamId: "T0TEST" } } : undefined);
    await expect(connectionSummary("owner-2")).resolves.toEqual({ configured: true, connected: false, workspace: null });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("unavailable"); }));
    await expect(disconnect("owner-1")).resolves.toEqual({ success: true, providerRevoked: false });
    expect(oauthStore.deleteOauthToken).toHaveBeenCalledWith("owner-1", "slack");
  });
});
