import { google } from "googleapis";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export const GOOGLE_WORKSPACE_SERVICES = ["Gmail", "Calendar", "Drive"] as const;

export const GOOGLE_WORKSPACE_TOOLS = [
  "google.workspace.health.verify",
  "google.workspace.authorization.revoke",
  "google.calendar.upcoming.read",
  "google.drive.recent_metadata.read",
  "gmail.send_with_local_approval",
] as const;

export function scopeCoverage(grantedScopes: string[]): Record<(typeof GOOGLE_WORKSPACE_SERVICES)[number], boolean> {
  const granted = new Set(grantedScopes);
  return {
    Gmail: granted.has("https://www.googleapis.com/auth/gmail.send") || granted.has("https://mail.google.com/"),
    Calendar: granted.has("https://www.googleapis.com/auth/calendar.readonly") || granted.has("https://www.googleapis.com/auth/calendar"),
    Drive: granted.has("https://www.googleapis.com/auth/drive.metadata.readonly") || granted.has("https://www.googleapis.com/auth/drive.readonly") || granted.has("https://www.googleapis.com/auth/drive"),
  };
}

interface OAuthStatePayload {
  userId: string;
  expiresAt: number;
  nonce: string;
  returnTo: string;
}

function safeReturnTo(value?: string): string {
  if (!value) return "/portfolios";
  if (/^\/company\/[1-9]\d*(?:#systems)?$/.test(value)) return value;
  if (/^\/portfolios(?:\/[1-9]\d*)?$/.test(value)) return value;
  return "/portfolios";
}

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function oauthStateSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters for OAuth state signing.");
  return secret;
}

export function createOAuthState(userId: string, now = Date.now(), returnTo = "/portfolios"): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: now + 10 * 60_000,
    nonce: randomBytes(16).toString("base64url"),
    returnTo: safeReturnTo(returnTo),
  })).toString("base64url");
  const signature = createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readOAuthState(state: string, userId: string, now = Date.now()): OAuthStatePayload | null {
  try {
    const [payload, receivedSignature] = state.split(".");
    if (!payload || !receivedSignature) return null;
    // codeql[js/insufficient-password-hash] OAuth state is an HMAC signature, not a password hash.
    const expectedSignature = createHmac("sha256", oauthStateSecret()).update(payload).digest();
    const received = Buffer.from(receivedSignature, "base64url");
    if (received.length !== expectedSignature.length || !timingSafeEqual(received, expectedSignature)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;
    if (decoded.userId !== userId || typeof decoded.expiresAt !== "number" || decoded.expiresAt < now) return null;
    return {
      userId,
      expiresAt: decoded.expiresAt,
      nonce: typeof decoded.nonce === "string" ? decoded.nonce : "",
      returnTo: safeReturnTo(decoded.returnTo),
    };
  } catch {
    return null;
  }
}

export function verifyOAuthState(state: string, userId: string, now = Date.now()): boolean {
  return readOAuthState(state, userId, now) !== null;
}

export function getAuthUrl(userId: string, returnTo?: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    include_granted_scopes: true,
    state: createOAuthState(userId, Date.now(), returnTo),
  });
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  return {
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token || undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scope: tokens.scope || undefined,
  };
}

export async function getAccessToken(userId: string): Promise<string> {
  const token = await storage.getOauthToken(userId, "gmail");
  if (!token) {
    throw new Error("Gmail not connected. Please connect Gmail first.");
  }

  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    if (!token.refreshToken) {
      throw new Error("Gmail token expired and no refresh token available. Please reconnect Gmail.");
    }
    const oauth2Client = getOAuth2Client();
    const refreshToken = decryptCredential(token.refreshToken);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();

    await storage.upsertOauthToken({
      userId,
      provider: "gmail",
      accessToken: credentials.access_token ? encryptCredential(credentials.access_token) : token.accessToken,
      refreshToken: credentials.refresh_token ? encryptCredential(credentials.refresh_token) : token.refreshToken,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      scope: token.scope || undefined,
    });

    return credentials.access_token || decryptCredential(token.accessToken);
  }

  return decryptCredential(token.accessToken);
}

export async function sendEmail(
  userId: string,
  params: { to: string; subject: string; body: string; cc?: string; bcc?: string }
): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const headers = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `Content-Type: text/html; charset=utf-8`,
  ];
  if (params.cc) headers.push(`Cc: ${params.cc}`);
  if (params.bcc) headers.push(`Bcc: ${params.bcc}`);

  const email = headers.join("\r\n") + "\r\n\r\n" + params.body;
  const encodedMessage = Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });

  return { messageId: result.data.id || "" };
}

export async function isConnected(userId: string): Promise<boolean> {
  try {
    if (!credentialEncryptionConfigured()) return false;
    const token = await storage.getOauthToken(userId, "gmail");
    if (!token) return false;
    decryptCredential(token.accessToken);
    return Object.values(scopeCoverage((token.scope || "").split(/\s+/).filter(Boolean))).every(Boolean);
  } catch {
    return false;
  }
}

export async function revokeAuthorization(userId: string): Promise<{ providerRevoked: boolean }> {
  const token = await storage.getOauthToken(userId, "gmail");
  if (!token) return { providerRevoked: true };

  let providerRevoked = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const credential = decryptCredential(token.refreshToken || token.accessToken);
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: credential }),
      signal: controller.signal,
    });
    if (response.ok) {
      providerRevoked = true;
    } else if (response.status === 400) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      providerRevoked = body.error === "invalid_token";
    }
  } catch {
    providerRevoked = false;
  } finally {
    clearTimeout(timeout);
  }
  return { providerRevoked };
}

export async function disconnect(userId: string): Promise<{ success: true; providerRevoked: boolean }> {
  try {
    const result = await revokeAuthorization(userId);
    return { success: true, providerRevoked: result.providerRevoked };
  } finally {
    await storage.deleteOauthToken(userId, "gmail");
  }
}

export function isConfigured(): boolean {
  try {
    oauthStateSecret();
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && credentialEncryptionConfigured());
  } catch {
    return false;
  }
}

export async function connectionSummary(userId: string): Promise<{
  configured: boolean;
  connected: boolean;
  grantedScopes: string[];
}> {
  const configured = isConfigured();
  if (!configured) return { configured: false, connected: false, grantedScopes: [] };
  const token = await storage.getOauthToken(userId, "gmail");
  if (!token) return { configured: true, connected: false, grantedScopes: [] };
  const grantedScopes = (token.scope || "").split(/\s+/).filter(Boolean);
  const connected = await isConnected(userId);
  return {
    configured: true,
    connected,
    grantedScopes,
  };
}

export async function verifyConnection(userId: string): Promise<{
  configured: boolean;
  connected: boolean;
  healthy: boolean;
  services: Record<(typeof GOOGLE_WORKSPACE_SERVICES)[number], boolean>;
  grantedScopes: string[];
}> {
  const summary = await connectionSummary(userId);
  const services = scopeCoverage(summary.grantedScopes);
  if (!summary.connected) return { ...summary, healthy: false, services };

  try {
    const accessToken = await getAccessToken(userId);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const checks = await Promise.allSettled([
      google.gmail({ version: "v1", auth: oauth2Client }).users.getProfile({ userId: "me" }),
      google.calendar({ version: "v3", auth: oauth2Client }).calendarList.list({ maxResults: 1 }),
      google.drive({ version: "v3", auth: oauth2Client }).about.get({ fields: "user" }),
    ]);
    services.Gmail = checks[0].status === "fulfilled";
    services.Calendar = checks[1].status === "fulfilled";
    services.Drive = checks[2].status === "fulfilled";
    return { ...summary, healthy: Object.values(services).every(Boolean), services };
  } catch {
    return { ...summary, healthy: false, services };
  }
}

export function requestedScopes(): string[] {
  return [...SCOPES];
}

export async function operatingContext(userId: string): Promise<{
  generatedAt: string;
  calendar: Array<{ id: string; summary: string; start: string | null; end: string | null; htmlLink: string | null }>;
  drive: Array<{ id: string; name: string; mimeType: string | null; modifiedTime: string | null; webViewLink: string | null }>;
}> {
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const [calendarResult, driveResult] = await Promise.all([
    google.calendar({ version: "v3", auth: oauth2Client }).events.list({ calendarId: "primary", timeMin: new Date().toISOString(), maxResults: 10, singleEvents: true, orderBy: "startTime" }),
    google.drive({ version: "v3", auth: oauth2Client }).files.list({ pageSize: 10, orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,modifiedTime,webViewLink)", q: "trashed = false" }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    calendar: (calendarResult.data.items || []).map((event) => ({ id: event.id || "", summary: event.summary || "Untitled event", start: event.start?.dateTime || event.start?.date || null, end: event.end?.dateTime || event.end?.date || null, htmlLink: event.htmlLink || null })),
    drive: (driveResult.data.files || []).map((file) => ({ id: file.id || "", name: file.name || "Untitled file", mimeType: file.mimeType || null, modifiedTime: file.modifiedTime || null, webViewLink: file.webViewLink || null })),
  };
}
