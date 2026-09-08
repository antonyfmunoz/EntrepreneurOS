import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauthStore = vi.hoisted(() => ({
  getOauthToken: vi.fn(), upsertOauthToken: vi.fn(), deleteOauthToken: vi.fn(),
}));

vi.mock("../../server/storage", () => ({ storage: oauthStore }));

import { encryptCredential } from "../../server/security/credential-encryption";
import { verifyConnection } from "../../server/integrations/quickbooks";

describe("QuickBooks company-file verification", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-thirty-two-characters";
    process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString("base64");
    process.env.QUICKBOOKS_CLIENT_ID = "quickbooks-client-id";
    process.env.QUICKBOOKS_CLIENT_SECRET = "quickbooks-client-secret";
    process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
    oauthStore.getOauthToken.mockReset();
    oauthStore.upsertOauthToken.mockReset();
    oauthStore.deleteOauthToken.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    for (const key of ["SESSION_SECRET", "EOS_CREDENTIAL_ENCRYPTION_KEY", "QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_ENVIRONMENT"]) delete process.env[key];
    vi.unstubAllGlobals();
  });

  it("accepts a CompanyInfo entity ID that differs from the OAuth realm after Intuit authorizes the exact realm-addressed request", async () => {
    const realmId = "9341457867789169";
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("sandbox-access-token"),
      refreshToken: encryptCredential("sandbox-refresh-token"),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      metadata: { realmId, environment: "sandbox" },
    });
    const providerFetch = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=75`);
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sandbox-access-token");
      expect(init.redirect).toBe("error");
      return new Response(JSON.stringify({ CompanyInfo: { Id: "1", CompanyName: "EOS Sandbox Company" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", providerFetch);

    await expect(verifyConnection("owner-1")).resolves.toMatchObject({
      connected: true,
      healthy: true,
      company: { realmId, companyName: "EOS Sandbox Company", environment: "sandbox" },
    });
    expect(oauthStore.upsertOauthToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: "owner-1",
      provider: "quickbooks",
      metadata: expect.objectContaining({ realmId }),
    }));
  });
});
