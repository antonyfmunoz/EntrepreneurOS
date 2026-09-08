import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauthStore = vi.hoisted(() => ({
  getOauthToken: vi.fn(), upsertOauthToken: vi.fn(), deleteOauthToken: vi.fn(),
}));

vi.mock("../../server/storage", () => ({ storage: oauthStore }));

import { encryptCredential } from "../../server/security/credential-encryption";
import {
  connectionSummary, createOAuthState, disconnect, getAuthUrl, readOAuthState, verifyConnection,
} from "../../server/integrations/quickbooks";

describe("QuickBooks Online OAuth", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-characters";
    process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString("base64");
    process.env.QUICKBOOKS_CLIENT_ID = "quickbooks-client-id";
    process.env.QUICKBOOKS_CLIENT_SECRET = "quickbooks-client-secret";
    process.env.QUICKBOOKS_REDIRECT_URI = "https://entrepreneuros.net/api/auth/quickbooks/callback";
    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    for (const mock of Object.values(oauthStore)) mock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const key of ["SESSION_SECRET", "EOS_CREDENTIAL_ENCRYPTION_KEY", "QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_REDIRECT_URI", "QUICKBOOKS_ENVIRONMENT"]) delete process.env[key];
    vi.unstubAllGlobals();
  });

  it("binds authorization state to one user and a safe local return route", () => {
    const state = createOAuthState("owner-1", 1_000, "/company/12#systems");
    expect(readOAuthState(state, "owner-1", 2_000)?.returnTo).toBe("/company/12#systems");
    expect(readOAuthState(state, "owner-2", 2_000)).toBeNull();
    expect(readOAuthState(state, "owner-1", 601_001)).toBeNull();
    const unsafe = createOAuthState("owner-1", 1_000, "https://attacker.example/callback");
    expect(readOAuthState(unsafe, "owner-1", 2_000)?.returnTo).toBe("/portfolios");
  });

  it("builds an Intuit authorization URL without exposing the client secret", () => {
    const url = new URL(getAuthUrl("owner-1", "/portfolios/4"));
    expect(`${url.origin}${url.pathname}`).toBe("https://appcenter.intuit.com/connect/oauth2");
    expect(url.searchParams.get("client_id")).toBe("quickbooks-client-id");
    expect(url.searchParams.get("scope")).toBe("com.intuit.quickbooks.accounting");
    expect(url.searchParams.get("redirect_uri")).toBe(process.env.QUICKBOOKS_REDIRECT_URI);
    expect(url.toString()).not.toContain("quickbooks-client-secret");
  });

  it("verifies an OAuth-authorized read at the exact realm-addressed company endpoint", async () => {
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("quickbooks-access"), refreshToken: encryptCredential("quickbooks-refresh"),
      expiresAt: new Date(Date.now() + 60 * 60_000), scope: "com.intuit.quickbooks.accounting",
      metadata: { realmId: "123456789012" }, tokenType: "Bearer",
    });
    const providerFetch = vi.fn(async (url: URL | string, init: RequestInit) => {
      expect(String(url)).toContain("/v3/company/123456789012/companyinfo/123456789012");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer quickbooks-access");
      return new Response(JSON.stringify({ CompanyInfo: { Id: "123456789012", CompanyName: "Empyrean Creative LLC", LegalName: "Empyrean Creative LLC", Country: "US", FiscalYearStartMonth: "January" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", providerFetch);

    await expect(verifyConnection("owner-1")).resolves.toMatchObject({ connected: true, healthy: true, company: { realmId: "123456789012", companyName: "Empyrean Creative LLC" } });
    const persisted = oauthStore.upsertOauthToken.mock.calls.at(-1)?.[0];
    expect(persisted).toEqual(expect.objectContaining({ userId: "owner-1", provider: "quickbooks" }));
    expect(persisted.metadata.realmId).toMatch(/^enc:v1:/);
    expect(persisted.metadata.realmId).not.toContain("123456789012");
  });

  it("preserves a large numeric company ID returned by Intuit without rounding it", async () => {
    const realmId = "9341457867789169";
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("quickbooks-access"), refreshToken: encryptCredential("quickbooks-refresh"),
      expiresAt: new Date(Date.now() + 60 * 60_000), scope: "com.intuit.quickbooks.accounting",
      metadata: { realmId }, tokenType: "Bearer",
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      `{\"CompanyInfo\":{\"CompanyAddr\":{\"Id\":1},\"Id\":${realmId},\"CompanyName\":\"EOS Sandbox Company\"}}`,
      { status: 200 },
    )));

    await expect(verifyConnection("owner-1")).resolves.toMatchObject({
      healthy: true, company: { realmId, companyName: "EOS Sandbox Company" },
    });
  });

  it("accepts a valid realm-addressed CompanyInfo response when its entity ID differs from the OAuth realm", async () => {
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("quickbooks-access"), refreshToken: encryptCredential("quickbooks-refresh"),
      expiresAt: new Date(Date.now() + 60 * 60_000), scope: "com.intuit.quickbooks.accounting",
      metadata: { realmId: "9341457867789169" }, tokenType: "Bearer",
    });
    const providerFetch = vi.fn(async (url: URL | string) => {
      expect(String(url)).toContain("/v3/company/9341457867789169/companyinfo/9341457867789169");
      return new Response(JSON.stringify({ CompanyInfo: { Id: "1", CompanyName: "EOS Sandbox Company" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", providerFetch);

    await expect(verifyConnection("owner-1")).resolves.toMatchObject({
      healthy: true, company: { realmId: "9341457867789169", companyName: "EOS Sandbox Company" },
    });
  });

  it("retries a transient accounting read once and records Intuit's safe support correlation id", async () => {
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("quickbooks-access"), refreshToken: encryptCredential("quickbooks-refresh"),
      expiresAt: new Date(Date.now() + 60 * 60_000), scope: "com.intuit.quickbooks.accounting",
      metadata: { realmId: "123456789012" }, tokenType: "Bearer",
    });
    const providerFetch = vi.fn()
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503, headers: { intuit_tid: "tid-retry-1" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ CompanyInfo: { Id: "123456789012", CompanyName: "Empyrean Creative LLC" } }), { status: 200, headers: { intuit_tid: "tid-success-1" } }));
    vi.stubGlobal("fetch", providerFetch);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(verifyConnection("owner-1")).resolves.toMatchObject({ healthy: true, company: { realmId: "123456789012" } });
    expect(providerFetch).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledWith("quickbooks_provider_response", expect.objectContaining({ operation: "accounting_read", status: 503, intuitTid: "tid-retry-1", attempt: 1 }));
    expect(info).toHaveBeenCalledWith("quickbooks_provider_response", expect.objectContaining({ operation: "accounting_read", status: 200, intuitTid: "tid-success-1", attempt: 2 }));
  });

  it("uses Intuit's sandbox API only for sandbox-scoped credentials", async () => {
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("quickbooks-sandbox-access"), refreshToken: encryptCredential("quickbooks-sandbox-refresh"),
      expiresAt: new Date(Date.now() + 60 * 60_000), scope: "com.intuit.quickbooks.accounting",
      metadata: { environment: "sandbox", realmId: "123456789012" }, tokenType: "Bearer",
    });
    const providerFetch = vi.fn(async (url: URL | string) => {
      expect(String(url)).toContain("https://sandbox-quickbooks.api.intuit.com/v3/company/123456789012/companyinfo/123456789012");
      return new Response(JSON.stringify({ CompanyInfo: { Id: "123456789012", CompanyName: "EOS Sandbox Company" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", providerFetch);

    await expect(verifyConnection("owner-1")).resolves.toMatchObject({ healthy: true, company: { environment: "sandbox", companyName: "EOS Sandbox Company" } });
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });

  it("does not expose a production credential while the sandbox runtime is selected", async () => {
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("quickbooks-production-access"), metadata: { environment: "production", realmId: "123456789012" },
    });

    await expect(connectionSummary("owner-1")).resolves.toEqual({ configured: true, connected: false, company: null });
  });

  it("does not represent another person's company file as connected", async () => {
    oauthStore.getOauthToken.mockImplementation(async (userId: string) => userId === "owner-1" ? { accessToken: encryptCredential("owner-1-access"), metadata: { realmId: "123456789012", companyName: "Owner company" } } : undefined);
    await expect(connectionSummary("owner-1")).resolves.toMatchObject({ connected: true, company: { realmId: "123456789012" } });
    await expect(connectionSummary("owner-2")).resolves.toEqual({ configured: true, connected: false, company: null });
  });

  it("removes the local encrypted credential if provider revocation is unavailable", async () => {
    oauthStore.getOauthToken.mockResolvedValue({ accessToken: encryptCredential("access-to-remove"), refreshToken: encryptCredential("refresh-to-remove"), metadata: {} });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("provider unavailable"); }));
    await expect(disconnect("owner-1")).resolves.toEqual({ success: true, providerRevoked: false });
    expect(oauthStore.deleteOauthToken).toHaveBeenCalledWith("owner-1", "quickbooks");
  });
});
