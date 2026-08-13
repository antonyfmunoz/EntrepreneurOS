import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauthStore = vi.hoisted(() => ({
  getOauthToken: vi.fn(),
  deleteOauthToken: vi.fn(),
}));

vi.mock("../../server/storage", () => ({ storage: oauthStore }));

import { encryptCredential } from "../../server/security/credential-encryption";
import { disconnect } from "../../server/integrations/gmail";

describe("Google Workspace disconnect", () => {
  beforeEach(() => {
    process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 29).toString("base64");
    oauthStore.getOauthToken.mockReset();
    oauthStore.deleteOauthToken.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.EOS_CREDENTIAL_ENCRYPTION_KEY;
    vi.unstubAllGlobals();
  });

  it("revokes the refresh token at Google before removing the local credential", async () => {
    oauthStore.getOauthToken.mockResolvedValue({
      accessToken: encryptCredential("google-access-token"),
      refreshToken: encryptCredential("google-refresh-token"),
    });
    const providerFetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
      expect(String(init.body)).toBe("token=google-refresh-token");
      expect(oauthStore.deleteOauthToken).not.toHaveBeenCalled();
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", providerFetch);

    await expect(disconnect("owner-1")).resolves.toEqual({ success: true, providerRevoked: true });
    expect(providerFetch).toHaveBeenCalledWith("https://oauth2.googleapis.com/revoke", expect.any(Object));
    expect(oauthStore.deleteOauthToken).toHaveBeenCalledWith("owner-1", "gmail");
  });

  it("treats Google's invalid_token response as already revoked", async () => {
    oauthStore.getOauthToken.mockResolvedValue({ accessToken: encryptCredential("expired-access"), refreshToken: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid_token" }), { status: 400, headers: { "content-type": "application/json" } })));

    await expect(disconnect("owner-1")).resolves.toEqual({ success: true, providerRevoked: true });
    expect(oauthStore.deleteOauthToken).toHaveBeenCalledWith("owner-1", "gmail");
  });

  it("removes the local credential and reports an unconfirmed provider revocation when Google is unavailable", async () => {
    oauthStore.getOauthToken.mockResolvedValue({ accessToken: encryptCredential("access-to-remove"), refreshToken: null });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("provider unavailable"); }));

    await expect(disconnect("owner-1")).resolves.toEqual({ success: true, providerRevoked: false });
    expect(oauthStore.deleteOauthToken).toHaveBeenCalledWith("owner-1", "gmail");
  });

  it("is idempotent when no local connection exists", async () => {
    oauthStore.getOauthToken.mockResolvedValue(undefined);
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);

    await expect(disconnect("owner-1")).resolves.toEqual({ success: true, providerRevoked: true });
    expect(providerFetch).not.toHaveBeenCalled();
    expect(oauthStore.deleteOauthToken).toHaveBeenCalledWith("owner-1", "gmail");
  });
});
