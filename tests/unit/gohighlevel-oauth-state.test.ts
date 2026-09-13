import { describe, expect, it } from "vitest";
import { createOAuthState, getAuthUrl, readOAuthState, readOAuthStateFromCallback } from "../../server/integrations/gohighlevel";

describe("GoHighLevel OAuth state", () => {
  it("binds authorization to the initiating EOS user and company Systems return path", async () => {
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "x".repeat(48);
    const state = await createOAuthState("operator-a", 1_000, "/company/12#systems");
    await expect(readOAuthState(state, "operator-a", 2_000)).resolves.toMatchObject({ returnTo: "/company/12#systems", completion: "redirect" });
    await expect(readOAuthState(state, "operator-b", 2_000)).resolves.toBeNull();
    await expect(readOAuthState(state, "operator-a", 700_001)).resolves.toBeNull();
    await expect(readOAuthStateFromCallback(state, 2_000)).resolves.toMatchObject({ userId: "operator-a", returnTo: "/company/12#systems" });
    await expect(readOAuthStateFromCallback(`${state}.tampered`, 2_000)).resolves.toBeNull();
    await expect(readOAuthStateFromCallback(state, 700_001)).resolves.toBeNull();
    const popupState = await createOAuthState("operator-a", 1_000, "/company/12#systems", "popup");
    await expect(readOAuthStateFromCallback(popupState, 2_000)).resolves.toMatchObject({ completion: "popup" });
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

    const popupAuthorizationUrl = new URL(await getAuthUrl("operator-a", "/company/12#systems", "popup"));
    const popupState = await readOAuthStateFromCallback(popupAuthorizationUrl.searchParams.get("state")!, Date.now());
    expect(popupState?.completion).toBe("popup");

    if (previous.sessionSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous.sessionSecret;
    if (previous.clientId === undefined) delete process.env.GOHIGHLEVEL_CLIENT_ID; else process.env.GOHIGHLEVEL_CLIENT_ID = previous.clientId;
    if (previous.clientSecret === undefined) delete process.env.GOHIGHLEVEL_CLIENT_SECRET; else process.env.GOHIGHLEVEL_CLIENT_SECRET = previous.clientSecret;
    if (previous.installationUrl === undefined) delete process.env.GOHIGHLEVEL_INSTALLATION_URL; else process.env.GOHIGHLEVEL_INSTALLATION_URL = previous.installationUrl;
    if (previous.redirectUri === undefined) delete process.env.GOHIGHLEVEL_REDIRECT_URI; else process.env.GOHIGHLEVEL_REDIRECT_URI = previous.redirectUri;
  });
});
