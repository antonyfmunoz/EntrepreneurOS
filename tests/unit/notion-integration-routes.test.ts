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
  verifyConnection: vi.fn(async () => ({ configured: true, connected: true, healthy: true, services: { Gmail: true, Calendar: true, Drive: true }, grantedScopes: ["https://www.googleapis.com/auth/gmail.send"], accountEmail: "operator@example.test" })),
  disconnect: vi.fn(async () => ({ success: true, providerRevoked: true })),
}));
const storageAdapter = vi.hoisted(() => ({
  upsertOauthToken: vi.fn(),
  deleteOauthToken: vi.fn(),
}));
const stripeHealthAdapter = vi.hoisted(() => ({
  verifyStripeConnection: vi.fn(async () => ({ connected: true, healthy: true, reason: "ready", scope: "merchant_identity_and_credential_configuration", deliveryVerified: false, externalReference: "provider:stripe:acct_fixture:merchant_identity_verified" })),
}));
const dbAdapter = vi.hoisted(() => ({
  bindings: [] as any[],
  select: vi.fn(() => ({ from: () => ({ where: () => dbAdapter.bindings }) })),
}));
const eosAccess = vi.hoisted(() => ({
  companyAccess: vi.fn(async () => ({
    company: { id: 12 },
    seat: { id: "seat-founder" },
    role: "founder",
    effectiveAuthority: { grants: [] },
    authorityCandidates: [],
  })),
  authorizeAction: vi.fn(async () => ({ outcome: "permit", decisionId: "decision-1" })),
}));

vi.mock("../../server/integrations/notion", () => notionAdapter);
vi.mock("../../server/integrations/gmail", () => gmailAdapter);
vi.mock("../../server/integrations/stripe-health", () => stripeHealthAdapter);
vi.mock("../../server/storage", () => ({ storage: storageAdapter }));
vi.mock("../../server/db", () => ({ db: dbAdapter }));
vi.mock("../../server/routes/eos-runtime", () => {
  class EosRouteError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  }
  return { ...eosAccess, EosRouteError };
});

import { registerIntegrationRoutes } from "../../server/routes/integrations";

describe("Notion integration HTTP controls", () => {
  const userId = "notion-route-owner";
  let api: ReturnType<typeof supertest>;

  beforeEach(() => {
    for (const mock of Object.values(notionAdapter)) if (typeof mock === "function" && "mockClear" in mock) (mock as any).mockClear();
    for (const mock of Object.values(gmailAdapter)) if (typeof mock === "function" && "mockClear" in mock) (mock as any).mockClear();
    storageAdapter.upsertOauthToken.mockReset();
    stripeHealthAdapter.verifyStripeConnection.mockClear();
    dbAdapter.bindings = [];
    eosAccess.companyAccess.mockClear();
    eosAccess.authorizeAction.mockClear();
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
    const response = await api.get("/api/eos/companies/12/integrations/notion/auth").expect(200);
    expect(response.body.authUrl).toContain("api.notion.com");
    expect(notionAdapter.getAuthUrl).toHaveBeenCalledWith(userId, "/company/12#systems");
    expect(eosAccess.companyAccess).toHaveBeenCalledTimes(1);
    expect(eosAccess.authorizeAction).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      authorityClass: "execute",
      actionKey: "integration_provider_authorization.request",
    }));
  });

  it("performs an explicit live verification for the signed-in user", async () => {
    const response = await api.get("/api/eos/companies/12/integrations/notion/status?verify=true").expect(200);
    expect(response.body).toEqual(expect.objectContaining({ healthy: true }));
    expect(notionAdapter.verifyConnection).toHaveBeenCalledWith(userId);
  });

  it("revokes and deletes only the signed-in user's connection", async () => {
    await api.post("/api/eos/companies/12/integrations/notion/disconnect").send({}).expect(200, { success: true, providerRevoked: true });
    expect(notionAdapter.disconnect).toHaveBeenCalledWith(userId);
  });

  it("routes Google disconnect through provider revocation for the signed-in user", async () => {
    await api.post("/api/eos/companies/12/integrations/gmail/disconnect").send({}).expect(200, { success: true, providerRevoked: true });
    expect(gmailAdapter.disconnect).toHaveBeenCalledWith(userId);
  });

  it("returns the verified Google account and the exact granted capabilities", async () => {
    const response = await api.get("/api/eos/companies/12/integrations/gmail/status?verify=true").expect(200);
    expect(response.body).toEqual(expect.objectContaining({
      healthy: true,
      accountEmail: "operator@example.test",
      grantedScopes: ["https://www.googleapis.com/auth/gmail.send"],
    }));
    expect(gmailAdapter.verifyConnection).toHaveBeenCalledWith(userId);
  });

  it("verifies a company-managed Stripe connection without exposing credentials", async () => {
    dbAdapter.bindings = [{ id: "stripe-binding-1", companyId: 12, providerKey: "stripe", providerAccountReference: "acct_fixture", lifecycleState: "active", credentialReference: "op://EOS/stripe/restricted-key" }];
    const response = await api.get("/api/eos/companies/12/integrations/stripe/status?verify=true").expect(200);
    expect(response.body).toEqual(expect.objectContaining({ configured: true, connected: true, healthy: true, accountReference: "acct_fixture", bindingId: "stripe-binding-1" }));
    expect(JSON.stringify(response.body)).not.toContain("restricted-key");
    expect(stripeHealthAdapter.verifyStripeConnection).toHaveBeenCalledWith(expect.objectContaining({ id: "stripe-binding-1" }));
  });

  it("does not register any legacy unscoped provider-control route", async () => {
    await api.get("/api/integrations/notion/status").expect(404);
    await api.post("/api/integrations/gmail/disconnect").send({}).expect(404);
  });

  it("rejects providers outside the bounded native registry", async () => {
    await api.get("/api/eos/companies/12/integrations/unknown/status").expect(404, {
      code: "integration_provider_not_found",
      message: "This provider is not available in the EOS integration registry.",
    });
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
    expect(response.headers.location).toBe("/company/12?notion=authorized#systems");
    expect(storageAdapter.upsertOauthToken).toHaveBeenCalledWith(expect.objectContaining({ userId, provider: "notion", metadata: { workspaceId: "workspace-1", workspaceName: "Workspace One" } }));
    const stored = storageAdapter.upsertOauthToken.mock.calls[0][0];
    expect(stored.accessToken).toMatch(/^enc:v1:/);
    expect(stored.refreshToken).toMatch(/^enc:v1:/);
    expect(JSON.stringify(stored)).not.toContain("notion-access-plaintext");
    expect(JSON.stringify(stored)).not.toContain("notion-refresh-plaintext");
    delete process.env.EOS_CREDENTIAL_ENCRYPTION_KEY;
  });
});
