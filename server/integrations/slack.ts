import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const AUTHORIZE_ENDPOINT = "https://slack.com/oauth/v2/authorize";
const TOKEN_ENDPOINT = "https://slack.com/api/oauth.v2.access";
const AUTH_TEST_ENDPOINT = "https://slack.com/api/auth.test";
const REVOKE_ENDPOINT = "https://slack.com/api/auth.revoke";

// Bot scopes only: EOS communicates as the accountable company integration,
// never by impersonating an individual employee. Channel membership and each
// outbound effect are still restricted by EOS role and approval policy.
const BOT_SCOPES = ["chat:write", "channels:read", "groups:read"];

export const SLACK_SERVICES = ["Internal channels", "Thread replies", "Decision links"] as const;
export const SLACK_TOOLS = [
  "slack.workspace.verify",
  "slack.channels.read",
  "slack.message.draft",
  "slack.message.send_with_local_approval",
] as const;

type OAuthStatePayload = { userId: string; expiresAt: number; nonce: string; returnTo: string };
export type SlackWorkspaceMetadata = { teamId?: string; teamName?: string; enterpriseId?: string; botUserId?: string; appId?: string; installerUserId?: string };

function safeReturnTo(value?: string): string {
  if (!value) return "/portfolios";
  if (/^\/company\/[1-9]\d*(?:#systems)?$/.test(value)) return value;
  if (/^\/portfolios(?:\/[1-9]\d*)?$/.test(value)) return value;
  return "/portfolios";
}

function stateSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters for OAuth state signing.");
  return secret;
}

function configuration(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.SLACK_CLIENT_ID?.trim();
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SLACK_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/slack/callback";
  if (!clientId || !clientSecret) throw new Error("Slack OAuth credentials are not configured.");
  return { clientId, clientSecret, redirectUri };
}

function readMetadata(value: unknown): SlackWorkspaceMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const string = (key: string) => typeof source[key] === "string" ? source[key] : undefined;
  return { teamId: string("teamId"), teamName: string("teamName"), enterpriseId: string("enterpriseId"), botUserId: string("botUserId"), appId: string("appId"), installerUserId: string("installerUserId") };
}

export function createOAuthState(userId: string, now = Date.now(), returnTo = "/portfolios"): string {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: now + 10 * 60_000, nonce: randomBytes(16).toString("base64url"), returnTo: safeReturnTo(returnTo) })).toString("base64url");
  return `${payload}.${createHmac("sha256", stateSecret()).update(`slack:${payload}`).digest("base64url")}`;
}

export function readOAuthState(state: string, userId: string, now = Date.now()): OAuthStatePayload | null {
  try {
    const [payload, receivedSignature] = state.split(".");
    if (!payload || !receivedSignature) return null;
    const expected = createHmac("sha256", stateSecret()).update(`slack:${payload}`).digest();
    const received = Buffer.from(receivedSignature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;
    if (decoded.userId !== userId || typeof decoded.expiresAt !== "number" || decoded.expiresAt < now) return null;
    return { userId, expiresAt: decoded.expiresAt, nonce: typeof decoded.nonce === "string" ? decoded.nonce : "", returnTo: safeReturnTo(decoded.returnTo) };
  } catch { return null; }
}

export function isConfigured(): boolean {
  try { stateSecret(); configuration(); return credentialEncryptionConfigured(); } catch { return false; }
}

export function getAuthUrl(userId: string, returnTo?: string): string {
  const { clientId, redirectUri } = configuration();
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", BOT_SCOPES.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", createOAuthState(userId, Date.now(), returnTo));
  return url.toString();
}

type TokenResponse = { ok?: boolean; error?: string; access_token?: string; token_type?: string; scope?: string; bot_user_id?: string; app_id?: string; team?: { id?: string; name?: string }; enterprise?: { id?: string }; authed_user?: { id?: string } };

export async function exchangeCode(code: string): Promise<{ accessToken: string; tokenType?: string; scope: string; metadata: SlackWorkspaceMetadata }> {
  const { clientId, clientSecret, redirectUri } = configuration();
  const response = await fetch(TOKEN_ENDPOINT, { method: "POST", signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }) });
  const result = await response.json().catch(() => ({})) as TokenResponse;
  if (!response.ok || !result.ok || !result.access_token || !result.team?.id) throw new Error(`Slack authorization failed with ${response.status}.`);
  return { accessToken: result.access_token, tokenType: result.token_type, scope: result.scope || BOT_SCOPES.join(","), metadata: { teamId: result.team.id, teamName: result.team.name, enterpriseId: result.enterprise?.id, botUserId: result.bot_user_id, appId: result.app_id, installerUserId: result.authed_user?.id } };
}

async function authTest(userId: string): Promise<{ ok?: boolean; error?: string; team_id?: string; team?: string; user_id?: string; bot_id?: string; enterprise_id?: string }> {
  const token = await storage.getOauthToken(userId, "slack");
  if (!token) throw new Error("Slack is not connected. Connect the company workspace first.");
  const response = await fetch(AUTH_TEST_ENDPOINT, { method: "POST", signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${decryptCredential(token.accessToken)}`, Accept: "application/json" } });
  return await response.json().catch(() => ({}));
}

export async function connectionSummary(userId: string): Promise<{ configured: boolean; connected: boolean; workspace: SlackWorkspaceMetadata | null }> {
  if (!isConfigured()) return { configured: false, connected: false, workspace: null };
  const token = await storage.getOauthToken(userId, "slack");
  if (!token) return { configured: true, connected: false, workspace: null };
  try { decryptCredential(token.accessToken); return { configured: true, connected: true, workspace: readMetadata(token.metadata) }; }
  catch { return { configured: true, connected: false, workspace: readMetadata(token.metadata) }; }
}

export async function verifyConnection(userId: string): Promise<{ configured: boolean; connected: boolean; healthy: boolean; workspace: SlackWorkspaceMetadata | null }> {
  const summary = await connectionSummary(userId);
  if (!summary.connected || !summary.workspace?.teamId) return { ...summary, healthy: false };
  try {
    const result = await authTest(userId);
    const healthy = result.ok === true && result.team_id === summary.workspace.teamId;
    if (!healthy) return { ...summary, healthy: false };
    const workspace = { ...summary.workspace, teamName: result.team || summary.workspace.teamName, botUserId: result.user_id || summary.workspace.botUserId, enterpriseId: result.enterprise_id || summary.workspace.enterpriseId };
    const token = await storage.getOauthToken(userId, "slack");
    if (token) await storage.upsertOauthToken({ userId, provider: "slack", accessToken: token.accessToken, refreshToken: token.refreshToken || undefined, tokenType: token.tokenType || undefined, expiresAt: token.expiresAt || undefined, scope: token.scope || BOT_SCOPES.join(","), metadata: workspace });
    return { configured: true, connected: true, healthy: true, workspace };
  } catch { return { ...summary, healthy: false }; }
}

export async function disconnect(userId: string): Promise<{ success: true; providerRevoked: boolean }> {
  const token = await storage.getOauthToken(userId, "slack");
  let providerRevoked = false;
  if (token) {
    try {
      const response = await fetch(REVOKE_ENDPOINT, { method: "POST", signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${decryptCredential(token.accessToken)}`, Accept: "application/json" } });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      providerRevoked = response.ok && result.ok === true;
    } catch { providerRevoked = false; }
  }
  await storage.deleteOauthToken(userId, "slack");
  return { success: true, providerRevoked };
}
