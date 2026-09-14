import { afterEach, describe, expect, it, vi } from "vitest";
import { createOAuthState, exchangeCode, getAuthUrl, readOAuthState, readOAuthStateFromCallback } from "../../server/integrations/docusign";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.DOCUSIGN_CLIENT_ID;
  delete process.env.DOCUSIGN_CLIENT_SECRET;
  delete process.env.DOCUSIGN_REDIRECT_URI;
  delete process.env.DOCUSIGN_OAUTH_BASE_URL;
  delete process.env.SESSION_SECRET;
});

describe("DocuSign OAuth authorization-code flow", () => {
  it("binds authorization state to a person and a safe company return path", async () => {
    process.env.SESSION_SECRET = "a".repeat(32);
    const state = await createOAuthState("seat-owner", Date.now(), "/company/12#systems");
    await expect(readOAuthState(state, "seat-owner")).resolves.toMatchObject({ userId: "seat-owner", returnTo: "/company/12#systems" });
    await expect(readOAuthState(state, "other-seat")).resolves.toBeNull();
    await expect(readOAuthStateFromCallback(state)).resolves.toMatchObject({ userId: "seat-owner" });
  });

  it("requests production consent with only the signing and refresh scopes", async () => {
    process.env.SESSION_SECRET = "b".repeat(32);
    process.env.DOCUSIGN_CLIENT_ID = "integration-key";
    process.env.DOCUSIGN_CLIENT_SECRET = "client-secret";
    process.env.DOCUSIGN_REDIRECT_URI = "https://entrepreneuros.net/api/auth/docusign/callback";
    const url = new URL(await getAuthUrl("seat-owner", "/company/12#systems"));
    expect(url.origin).toBe("https://account.docusign.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("signature extended offline_access");
    expect(url.searchParams.get("redirect_uri")).toBe("https://entrepreneuros.net/api/auth/docusign/callback");
  });

  it("stores the provider-selected default account base URI rather than assuming a regional API host", async () => {
    process.env.DOCUSIGN_CLIENT_ID = "integration-key";
    process.env.DOCUSIGN_CLIENT_SECRET = "client-secret";
    process.env.DOCUSIGN_REDIRECT_URI = "https://entrepreneuros.net/api/auth/docusign/callback";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", refresh_token: "refresh-token", token_type: "Bearer", expires_in: 3600, scope: "signature extended offline_access" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "docusign-user", name: "Owner", email: "owner@example.test", accounts: [{ account_id: "account-1", account_name: "Empyrean Studios", base_uri: "https://na4.docusign.net/restapi", is_default: true }] }), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;
    const tokens = await exchangeCode("provider-code");
    expect(tokens.metadata).toMatchObject({ accountId: "account-1", accountName: "Empyrean Studios", baseUri: "https://na4.docusign.net", grantedScopes: ["signature", "extended", "offline_access"] });
    expect(fetchMock.mock.calls[0][0]).toBe("https://account.docusign.com/oauth/token");
  });
});
