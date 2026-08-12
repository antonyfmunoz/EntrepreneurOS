import { client } from "../server/db";
import { storage } from "../server/storage";
import { encryptCredential } from "../server/security/credential-encryption";

async function main() {
  const refreshToken = process.env.GOOGLE_WORKSPACE_REFRESH_TOKEN?.trim();
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!refreshToken || !clientId || !clientSecret) throw new Error("Google Workspace import configuration is incomplete.");

  const tokenResponse = await fetch(process.env.GOOGLE_TOKEN_URI || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) throw new Error("Google rejected the refresh credential.");
  const token = await tokenResponse.json() as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!token.access_token) throw new Error("Google did not return an access credential.");

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error("The Google credential cannot resolve its Gmail identity.");
  const profile = await profileResponse.json() as { emailAddress?: string };
  const providerEmail = profile.emailAddress?.trim().toLowerCase();
  if (!providerEmail) throw new Error("Google did not return an account email.");

  const matches = (await storage.getUsers()).filter((user) => user.email.trim().toLowerCase() === providerEmail);
  if (matches.length !== 1) throw new Error("The Google identity did not match exactly one EOS owner. No credential was imported.");

  await storage.upsertOauthToken({
    userId: matches[0].id,
    provider: "gmail",
    accessToken: encryptCredential(token.access_token),
    refreshToken: encryptCredential(refreshToken),
    tokenType: token.token_type || "Bearer",
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1_000) : undefined,
    scope: token.scope,
  });
  console.log(JSON.stringify({ imported: true, identityMatched: true, scopeCount: String(token.scope || "").split(/\s+/).filter(Boolean).length }));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ imported: false, reason: error instanceof Error ? error.message : "Import failed." }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end({ timeout: 5 });
  });
