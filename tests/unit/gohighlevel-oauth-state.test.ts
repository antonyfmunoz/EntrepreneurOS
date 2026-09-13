import { describe, expect, it, vi } from "vitest";
import { createOAuthState, exchangeCode, getAuthUrl, readOAuthState, readOAuthStateFromCallback } from "../../server/integrations/gohighlevel";

describe("GoHighLevel OAuth state", () => {
  it("binds authorization to the initiating EOS user and company Systems return path", async () => {
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "x".repeat(48);
    const state = await createOAuthState("operator-a", 1_000, "/company/12#systems");
    await expect(readOAuthState(state, "operator-a", 2_000)).resolves.toMatchObject({ returnTo: "/company/12#systems" });
    await expect(readOAuthState(state, "operator-b", 2_000)).resolves.toBeNull();
    await expect(readOAuthState(state, "operator-a", 700_001)).resolves.toBeNull();
    await expect(readOAuthStateFromCallback(state, 2_000)).resolves.toMatchObject({ userId: "operator-a", returnTo: "/company/12#systems" });
    await expect(readOAuthStateFromCallback(`${state}.tampered`, 2_000)).resolves.toBeNull();
    await expect(readOAuthStateFromCallback(state, 700_001)).resolves.toBeNull();
    if (original === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = original;
  });

  it("includes the registered client identifier in the Marketplace installation URL", async () => {
    const previous = {
      sessionSecret: process.env.SESSION_SECRET,
      clientId: process.env.GOHIGHLEVEL_CLIENT_ID,
      clientSecret: process.env.GOHIGHLEVEL_CLIENT_SECRET,
      installationUrl: process.env.GOHIGHLEVEL_INSTALLATION_URL,
      redirectUri: process.env.GOHIGHLEVEL_REDIRECT_URI,
    };
    process.env.SESSION_SECRET = "x".repeat(48);
    process.env.GOHIGHLEVEL_CLIENT_ID = "registered-client-id";
    process.env.GOHIGHLEVEL_CLIENT_SECRET = "registered-client-secret";
    process.env.GOHIGHLEVEL_INSTALLATION_URL = "https://marketplace.gohighlevel.com/v2/oauth/chooselocation?response_type=code&version_id=app-version&scope=contacts.readonly";
    process.env.GOHIGHLEVEL_REDIRECT_URI = "https://entrepreneuros.net/api/auth/crm/callback";

    const authorizationUrl = new URL(await getAuthUrl("operator-a", "/company/12#systems"));
    expect(authorizationUrl.searchParams.get("client_id")).toBe("registered-client-id");
    expect(authorizationUrl.searchParams.get("version_id")).toBe("app-version");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe("https://entrepreneuros.net/api/auth/crm/callback");
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();

    if (previous.sessionSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous.sessionSecret;
    if (previous.clientId === undefined) delete process.env.GOHIGHLEVEL_CLIENT_ID; else process.env.GOHIGHLEVEL_CLIENT_ID = previous.clientId;
    if (previous.clientSecret === undefined) delete process.env.GOHIGHLEVEL_CLIENT_SECRET; else process.env.GOHIGHLEVEL_CLIENT_SECRET = previous.clientSecret;
    if (previous.installationUrl === undefined) delete process.env.GOHIGHLEVEL_INSTALLATION_URL; else process.env.GOHIGHLEVEL_INSTALLATION_URL = previous.installationUrl;
    if (previous.redirectUri === undefined) delete process.env.GOHIGHLEVEL_REDIRECT_URI; else process.env.GOHIGHLEVEL_REDIRECT_URI = previous.redirectUri;
  });

  it("exchanges a returned code using HighLevel's form-encoded token contract", async () => {
    const previous = {
      clientId: process.env.GOHIGHLEVEL_CLIENT_ID,
      clientSecret: process.env.GOHIGHLEVEL_CLIENT_SECRET,
      installationUrl: process.env.GOHIGHLEVEL_INSTALLATION_URL,
      redirectUri: process.env.GOHIGHLEVEL_REDIRECT_URI,
      fetch: globalThis.fetch,
    };
    process.env.GOHIGHLEVEL_CLIENT_ID = "registered-client-id";
    process.env.GOHIGHLEVEL_CLIENT_SECRET = "registered-client-secret";
    process.env.GOHIGHLEVEL_INSTALLATION_URL = "https://marketplace.gohighlevel.com/v2/oauth/chooselocation?version_id=app-version";
    process.env.GOHIGHLEVEL_REDIRECT_URI = "https://entrepreneuros.net/api/auth/crm/callback";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, locationId: "location-1", scope: "contacts.readonly",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(exchangeCode("provider-code")).resolves.toMatchObject({ accessToken: "access-token", metadata: { locationId: "location-1" } });
      const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(request.headers).toEqual(expect.objectContaining({
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Version: "2021-07-28",
      }));
      expect(request.body).toBe("client_id=registered-client-id&client_secret=registered-client-secret&redirect_uri=https%3A%2F%2Fentrepreneuros.net%2Fapi%2Fauth%2Fcrm%2Fcallback&grant_type=authorization_code&code=provider-code&user_type=Location");
    } finally {
      globalThis.fetch = previous.fetch;
      if (previous.clientId === undefined) delete process.env.GOHIGHLEVEL_CLIENT_ID; else process.env.GOHIGHLEVEL_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.GOHIGHLEVEL_CLIENT_SECRET; else process.env.GOHIGHLEVEL_CLIENT_SECRET = previous.clientSecret;
      if (previous.installationUrl === undefined) delete process.env.GOHIGHLEVEL_INSTALLATION_URL; else process.env.GOHIGHLEVEL_INSTALLATION_URL = previous.installationUrl;
      if (previous.redirectUri === undefined) delete process.env.GOHIGHLEVEL_REDIRECT_URI; else process.env.GOHIGHLEVEL_REDIRECT_URI = previous.redirectUri;
    }
  });

  it("uses the single approved location when HighLevel omits locationId from a completed installation", async () => {
    const previous = {
      clientId: process.env.GOHIGHLEVEL_CLIENT_ID,
      clientSecret: process.env.GOHIGHLEVEL_CLIENT_SECRET,
      installationUrl: process.env.GOHIGHLEVEL_INSTALLATION_URL,
      fetch: globalThis.fetch,
    };
    process.env.GOHIGHLEVEL_CLIENT_ID = "registered-client-id";
    process.env.GOHIGHLEVEL_CLIENT_SECRET = "registered-client-secret";
    process.env.GOHIGHLEVEL_INSTALLATION_URL = "https://marketplace.gohighlevel.com/v2/oauth/chooselocation?version_id=app-version";
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      access_token: "access-token", approvedLocations: ["selected-location"], companyId: "company-1",
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    try {
      await expect(exchangeCode("provider-code")).resolves.toMatchObject({ metadata: { locationId: "selected-location", companyId: "company-1" } });
    } finally {
      globalThis.fetch = previous.fetch;
      if (previous.clientId === undefined) delete process.env.GOHIGHLEVEL_CLIENT_ID; else process.env.GOHIGHLEVEL_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.GOHIGHLEVEL_CLIENT_SECRET; else process.env.GOHIGHLEVEL_CLIENT_SECRET = previous.clientSecret;
      if (previous.installationUrl === undefined) delete process.env.GOHIGHLEVEL_INSTALLATION_URL; else process.env.GOHIGHLEVEL_INSTALLATION_URL = previous.installationUrl;
    }
  });

  it("resolves one installed location for a company token that omits location metadata", async () => {
    const previous = {
      clientId: process.env.GOHIGHLEVEL_CLIENT_ID,
      clientSecret: process.env.GOHIGHLEVEL_CLIENT_SECRET,
      installationUrl: process.env.GOHIGHLEVEL_INSTALLATION_URL,
      fetch: globalThis.fetch,
    };
    process.env.GOHIGHLEVEL_CLIENT_ID = "registered-app-id-suffix";
    process.env.GOHIGHLEVEL_CLIENT_SECRET = "registered-client-secret";
    process.env.GOHIGHLEVEL_INSTALLATION_URL = "https://marketplace.gohighlevel.com/v2/oauth/chooselocation?version_id=registered-version";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token", companyId: "company-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ locations: [{ _id: "installed-location", isInstalled: true }] }), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(exchangeCode("provider-code")).resolves.toMatchObject({ metadata: { locationId: "installed-location", companyId: "company-1" } });
      expect(String(fetchMock.mock.calls[1][0])).toBe("https://services.leadconnectorhq.com/oauth/installedLocations?companyId=company-1&appId=registered&isInstalled=true&limit=100&versionId=registered-version");
      expect(fetchMock.mock.calls[1][1].headers).toEqual(expect.objectContaining({ Authorization: "Bearer access-token", Version: "2021-07-28" }));
    } finally {
      globalThis.fetch = previous.fetch;
      if (previous.clientId === undefined) delete process.env.GOHIGHLEVEL_CLIENT_ID; else process.env.GOHIGHLEVEL_CLIENT_ID = previous.clientId;
      if (previous.clientSecret === undefined) delete process.env.GOHIGHLEVEL_CLIENT_SECRET; else process.env.GOHIGHLEVEL_CLIENT_SECRET = previous.clientSecret;
      if (previous.installationUrl === undefined) delete process.env.GOHIGHLEVEL_INSTALLATION_URL; else process.env.GOHIGHLEVEL_INSTALLATION_URL = previous.installationUrl;
    }
  });
});
