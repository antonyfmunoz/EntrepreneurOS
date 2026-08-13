import express from "express";
import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notionAdapter = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  getAuthUrl: vi.fn(() => "https://api.notion.com/v1/oauth/authorize?state=signed"),
  connectionSummary: vi.fn(async () => ({ configured: true, connected: true, workspace: { workspaceId: "workspace-1" } })),
  verifyConnection: vi.fn(async () => ({ configured: true, connected: true, healthy: true, workspace: { workspaceId: "workspace-1" } })),
  disconnect: vi.fn(async () => ({ success: true, providerRevoked: true })),
  readOAuthState: vi.fn(),
  exchangeCode: vi.fn(),
}));
const gmailAdapter = vi.hoisted(() => ({
  isConfigured: vi.fn(() => false),
  getAuthUrl: vi.fn(),
  readOAuthState: vi.fn(),
  exchangeCode: vi.fn(),
  connectionSummary: vi.fn(async () => ({ configured: false, connected: false, grantedScopes: [] })),
  verifyConnection: vi.fn(async () => ({ configured: false, connected: false, healthy: false, services: {}, grantedScopes: [] })),
  disconnect: vi.fn(async () => ({ success: true, providerRevoked: true })),
}));
const storageAdapter = vi.hoisted(() => ({
  getIntegrations: vi.fn(async () => []),
  upsertOauthToken: vi.fn(),
  deleteOauthToken: vi.fn(),
}));

vi.mock("../../server/integrations/notion", () => notionAdapter);
vi.mock("../../server/integrations/gmail", () => gmailAdapter);
vi.mock("../../server/storage", () => ({ storage: storageAdapter }));

import { registerIntegrationRoutes } from "../../server/routes/integrations";

describe("Notion integration HTTP controls", () => {
  const userId = "notion-route-owner";
  let api: ReturnType<typeof supertest>;

  beforeEach(() => {
    for (const mock of Object.values(notionAdapter)) if (typeof mock === "function" && "mockClear" in mock) (mock as any).mockClear();
    for (const mock of Object.values(gmailAdapter)) if (typeof mock === "function" && "mockClear" in mock) (mock as any).mockClear();
    storageAdapter.upsertOauthToken.mockReset();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: userId };
      (req as any).isAuthenticated = () => true;
      next();
    });
    registerIntegrationRoutes(app);
    api = supertest(app);
  });

  it("creates an authorization request bound to the signed-in user and return path", async () => {
    const response = await api.get("/api/integrations/notion/auth?returnTo=%2Fcompany%2F12%23systems").expect(200);
    expect(response.body.authUrl).toContain("api.notion.com");
    expect(notionAdapter.getAuthUrl).toHaveBeenCalledWith(userId, "/company/12#systems");
  });

  it("performs an explicit live verification for the signed-in user", async () => {
    const response = await api.get("/api/integrations/notion/status?verify=true").expect(200);
    expect(response.body).toEqual(expect.objectContaining({ healthy: true }));
    expect(notionAdapter.verifyConnection).toHaveBeenCalledWith(userId);
  });

  it("revokes and deletes only the signed-in user's connection", async () => {
    await api.post("/api/integrations/notion/disconnect").send({}).expect(200, { success: true, providerRevoked: true });
    expect(notionAdapter.disconnect).toHaveBeenCalledWith(userId);
  });

  it("routes Google disconnect through provider revocation for the signed-in user", async () => {
    await api.post("/api/integrations/gmail/disconnect").send({}).expect(200, { success: true, providerRevoked: true });
    expect(gmailAdapter.disconnect).toHaveBeenCalledWith(userId);
  });

  it("stores callback credentials encrypted and returns to the initiating company", async () => {
    process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString("base64");
    notionAdapter.readOAuthState.mockReturnValue({ userId, expiresAt: Date.now() + 60_000, nonce: "nonce", returnTo: "/company/12#systems" });
    notionAdapter.exchangeCode.mockResolvedValue({
      accessToken: "notion-access-plaintext",
      refreshToken: "notion-refresh-plaintext",
      tokenType: "bearer",
      metadata: { workspaceId: "workspace-1", workspaceName: "Workspace One" },
    });

    const response = await api.get("/api/auth/notion/callback?code=provider-code&state=signed-state").expect(302);
    expect(response.headers.location).toBe("/company/12?notion=connected#systems");
    expect(storageAdapter.upsertOauthToken).toHaveBeenCalledWith(expect.objectContaining({ userId, provider: "notion", metadata: { workspaceId: "workspace-1", workspaceName: "Workspace One" } }));
    const stored = storageAdapter.upsertOauthToken.mock.calls[0][0];
    expect(stored.accessToken).toMatch(/^enc:v1:/);
    expect(stored.refreshToken).toMatch(/^enc:v1:/);
    expect(JSON.stringify(stored)).not.toContain("notion-access-plaintext");
    expect(JSON.stringify(stored)).not.toContain("notion-refresh-plaintext");
    delete process.env.EOS_CREDENTIAL_ENCRYPTION_KEY;
  });
});
