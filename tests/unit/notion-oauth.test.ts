import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauthStore = vi.hoisted(() => ({
  getOauthToken: vi.fn(),
  upsertOauthToken: vi.fn(),
  deleteOauthToken: vi.fn(),
}));

vi.mock("../../server/storage", () => ({ storage: oauthStore }));

import { encryptCredential } from "../../server/security/credential-encryption";
import {
  connectionSummary,
  createOAuthState,
  disconnect,
  getAuthUrl,
  readOAuthState,
  searchWorkspace,
} from "../../server/integrations/notion";

describe("Notion public OAuth", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-characters";
    process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
    process.env.NOTION_CLIENT_ID = "notion-client-id";
    process.env.NOTION_CLIENT_SECRET = "notion-client-secret";
    process.env.NOTION_REDIRECT_URI = "https://entrepreneuros.net/api/auth/notion/callback";
    oauthStore.getOauthToken.mockReset();
    oauthStore.upsertOauthToken.mockReset();
    oauthStore.deleteOauthToken.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.EOS_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.NOTION_CLIENT_ID;
    delete process.env.NOTION_CLIENT_SECRET;
    delete process.env.NOTION_REDIRECT_URI;
    vi.unstubAllGlobals();
  });

  it("binds signed state to one user and an allowlisted local return path", () => {
    const state = createOAuthState("owner-1", 1_000, "/company/12#systems");
    expect(readOAuthState(state, "owner-1", 2_000)?.returnTo).toBe("/company/12#systems");
    expect(readOAuthState(state, "owner-2", 2_000)).toBeNull();
    expect(readOAuthState(state, "owner-1", 1_000 + 10 * 60_000 + 1)).toBeNull();

    const unsafe = createOAuthState("owner-1", 1_000, "https://attacker.example/collect");
    expect(readOAuthState(unsafe, "owner-1", 2_000)?.returnTo).toBe("/portfolios");
  });

  it("builds the documented public authorization request without exposing the client secret", () => {
    const url = new URL(getAuthUrl("owner-1", "/portfolios/4"));
    expect(`${url.origin}${url.pathname}`).toBe("https://api.notion.com/v1/oauth/authorize");
    expect(url.searchParams.get("owner")).toBe("user");
    expect(url.searchParams.get("client_id")).toBe("notion-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(process.env.NOTION_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.toString()).not.toContain("notion-client-secret");
  });

  it("does not represent another user's workspace credential as connected", async () => {
    oauthStore.getOauthToken.mockImplementation(async (userId: string) => userId === "owner-1" ? {
      accessToken: encryptCredential("owner-1-access"),
      metadata: { workspaceId: "workspace-1", workspaceName: "Owner Workspace" },
    } : undefined);

    await expect(connectionSummary("owner-1")).resolves.toMatchObject({ connected: true, workspace: { workspaceId: "workspace-1" } });
    await expect(connectionSummary("owner-2")).resolves.toEqual({ configured: true, connected: false, workspace: null });
  });

  it("searches only with the initiating user's decrypted bearer token", async () => {
    oauthStore.getOauthToken.mockResolvedValue({ accessToken: encryptCredential("user-scoped-access"), refreshToken: null, metadata: {} });
    const providerFetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer user-scoped-access");
      expect((init.headers as Record<string, string>)["Notion-Version"]).toBe("2026-03-11");
      return new Response(JSON.stringify({ results: [{ id: "page-1", object: "page", properties: { title: { title: [{ plain_text: "Operating Plan" }] } }, url: "https://notion.so/page-1", last_edited_time: "2026-08-13T00:00:00.000Z" }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", providerFetch);

    await expect(searchWorkspace("owner-1", "plan", 20)).resolves.toEqual([expect.objectContaining({ id: "page-1", title: "Operating Plan" })]);
    expect(oauthStore.getOauthToken).toHaveBeenCalledWith("owner-1", "notion");
  });

  it("always removes the local credential even when provider revocation is unavailable", async () => {
    oauthStore.getOauthToken.mockResolvedValue({ accessToken: encryptCredential("access-to-remove"), metadata: {} });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("provider unavailable"); }));

    await expect(disconnect("owner-1")).resolves.toEqual({ success: true, providerRevoked: false });
    expect(oauthStore.deleteOauthToken).toHaveBeenCalledWith("owner-1", "notion");
  });
});
