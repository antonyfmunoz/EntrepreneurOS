import { hkdfSync, randomBytes, webcrypto } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const API_URL = "https://slack.com/api";
const BOT_SCOPES = ["chat:write", "channels:read", "groups:read"] as const;

type OAuthState = { userId: string; expiresAt: number; nonce: string; returnTo: string };
type OAuthResponse = {
  ok?: boolean; error?: string; access_token?: string; token_type?: string; scope?: string;
  bot_user_id?: string; app_id?: string; team?: { id?: string; name?: string; }; enterprise?: { id?: string; name?: string; };
};
type AuthTestResponse = { ok?: boolean; error?: string; team_id?: string; team?: string; user_id?: string; bot_id?: string; url?: string; };
type Conversation = { id?: string; name?: string; is_private?: boolean; is_archived?: boolean; is_member?: boolean; };
type ConversationsResponse = { ok?: boolean; error?: string; channels?: Conversation[]; response_metadata?: { next_cursor?: string; }; };
type PostMessageResponse = { ok?: boolean; error?: string; channel?: string; ts?: string; message?: { ts?: string; }; };

export type SlackWorkspace = {
  teamId?: string; teamName?: string; botUserId?: string; botId?: string; appId?: string; enterpriseId?: string; enterpriseName?: string; url?: string;
};

function safeReturnTo(value?: string): string {
  if (!value) return "/portfolios";
  if (/^\/company\/[1-9]\d*(?:#systems)?$/.test(value)) return value;
  if (/^\/portfolios(?:\/[1-9]\d*)?$/.test(value)) return value;
  return "/portfolios";
}

function stateSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters for Slack OAuth state signing.");
  return secret;
}

async function stateSigningKey(): Promise<CryptoKey> {
  const keyMaterial = Buffer.from(hkdfSync("sha256", stateSecret(), "entrepreneuros/slack-oauth-state/v1", "authorization-response-integrity", 32));
  return webcrypto.subtle.importKey("raw", keyMaterial, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function stateMessage(payload: string): Uint8Array { return new TextEncoder().encode(`slack:${payload}`); }
async function signState(payload: string): Promise<string> {
  return Buffer.from(await webcrypto.subtle.sign("HMAC", await stateSigningKey(), stateMessage(payload))).toString("base64url");
}

function configuration() {
  const clientId = process.env.SLACK_CLIENT_ID?.trim();
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SLACK_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/slack/callback";
  if (!clientId || !clientSecret) throw new Error("Slack OAuth credentials are not configured.");
  return { clientId, clientSecret, redirectUri } as const;
}

function metadata(value: unknown): SlackWorkspace {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const item = value as Record<string, unknown>;
  const string = (key: string) => typeof item[key] === "string" ? item[key] : undefined;
  return { teamId: string("teamId"), teamName: string("teamName"), botUserId: string("botUserId"), botId: string("botId"), appId: string("appId"), enterpriseId: string("enterpriseId"), enterpriseName: string("enterpriseName"), url: string("url") };
}

function grantedScopes(value?: string | null): string[] {
  return Array.from(new Set((value || "").split(",").map((scope) => scope.trim()).filter(Boolean)));
}

async function api<T>(accessToken: string, method: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_URL}/${method}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) }, signal: controller.signal });
    if (!response.ok) throw new Error(`Slack ${method} failed with ${response.status}.`);
    const result = await response.json() as T & { ok?: boolean; error?: string };
    if (result.ok === false) throw new Error(`Slack ${method} failed: ${result.error || "unknown_error"}.`);
    return result;
  } finally { clearTimeout(timeout); }
}

async function accessToken(userId: string): Promise<string> {
  const token = await storage.getOauthToken(userId, "slack");
  if (!token) throw new Error("Slack is not connected. Connect the company workspace first.");
  return decryptCredential(token.accessToken);
}

export const SLACK_TOOLS = ["slack.workspace.verify", "slack.conversations.list", "slack.message.send"] as const;

export async function createOAuthState(userId: string, now = Date.now(), returnTo = "/portfolios"): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: now + 10 * 60_000, nonce: randomBytes(16).toString("base64url"), returnTo: safeReturnTo(returnTo) })).toString("base64url");
  return `${payload}.${await signState(payload)}`;
}

export async function readOAuthState(state: string, userId: string, now = Date.now()): Promise<OAuthState | null> {
  try {
    const [payload, receivedSignature] = state.split(".");
    if (!payload || !receivedSignature) return null;
    if (!(await webcrypto.subtle.verify("HMAC", await stateSigningKey(), Buffer.from(receivedSignature, "base64url"), stateMessage(payload)))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OAuthState>;
    if (decoded.userId !== userId || typeof decoded.expiresAt !== "number" || decoded.expiresAt < now) return null;
    return { userId, expiresAt: decoded.expiresAt, nonce: typeof decoded.nonce === "string" ? decoded.nonce : "", returnTo: safeReturnTo(decoded.returnTo) };
  } catch { return null; }
}

export function isConfigured(): boolean { try { stateSecret(); configuration(); return credentialEncryptionConfigured(); } catch { return false; } }

export async function getAuthUrl(userId: string, returnTo?: string): Promise<string> {
  const { clientId, redirectUri } = configuration(); const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId); url.searchParams.set("redirect_uri", redirectUri); url.searchParams.set("scope", BOT_SCOPES.join(",")); url.searchParams.set("state", await createOAuthState(userId, Date.now(), returnTo));
  return url.toString();
}

export async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = configuration();
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_URL}/oauth.v2.access`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body, signal: controller.signal });
    if (!response.ok) throw new Error(`Slack authorization failed with ${response.status}.`);
    const result = await response.json() as OAuthResponse;
    if (!result.ok || !result.access_token || !result.team?.id) throw new Error(`Slack authorization failed: ${result.error || "missing_workspace_token"}.`);
    return { accessToken: result.access_token, tokenType: result.token_type || "bot", scope: result.scope || BOT_SCOPES.join(","), metadata: { teamId: result.team.id, teamName: result.team.name || undefined, botUserId: result.bot_user_id || undefined, appId: result.app_id || undefined, enterpriseId: result.enterprise?.id || undefined, enterpriseName: result.enterprise?.name || undefined } satisfies SlackWorkspace };
  } finally { clearTimeout(timeout); }
}

export async function connectionSummary(userId: string) {
  if (!isConfigured()) return { configured: false, connected: false, workspace: null, grantedScopes: [] as string[] };
  const token = await storage.getOauthToken(userId, "slack");
  if (!token) return { configured: true, connected: false, workspace: null, grantedScopes: [] as string[] };
  try { decryptCredential(token.accessToken); const workspace = metadata(token.metadata); return { configured: true, connected: Boolean(workspace.teamId), workspace: workspace.teamId ? workspace : null, grantedScopes: grantedScopes(token.scope) }; }
  catch { return { configured: true, connected: false, workspace: null, grantedScopes: [] as string[] }; }
}

export async function verifyConnection(userId: string) {
  const summary = await connectionSummary(userId);
  if (!summary.connected || !summary.workspace?.teamId) return { ...summary, healthy: false };
  try {
    const current = await api<AuthTestResponse>(await accessToken(userId), "auth.test", { method: "POST" });
    if (!current.team_id || current.team_id !== summary.workspace.teamId) return { ...summary, healthy: false };
    const workspace = { ...summary.workspace, teamName: current.team || summary.workspace.teamName, botId: current.bot_id || summary.workspace.botId, url: current.url || summary.workspace.url };
    const token = await storage.getOauthToken(userId, "slack");
    if (token) await storage.upsertOauthToken({ userId, provider: "slack", accessToken: token.accessToken, tokenType: token.tokenType || "bot", scope: token.scope || BOT_SCOPES.join(","), metadata: workspace });
    return { configured: true, connected: true, healthy: true, workspace, grantedScopes: summary.grantedScopes };
  } catch { return { ...summary, healthy: false }; }
}

export async function listConversations(userId: string, limit = 100) {
  const verified = await verifyConnection(userId); if (!verified.healthy || !verified.workspace?.teamId) throw new Error("Slack authorization is unavailable or unhealthy.");
  const query = new URLSearchParams({ limit: String(Math.min(200, Math.max(1, Math.trunc(limit)))), exclude_archived: "true", types: "public_channel,private_channel" });
  const result = await api<ConversationsResponse>(await accessToken(userId), `conversations.list?${query.toString()}`, { method: "GET" });
  return { workspace: verified.workspace, channels: (result.channels || []).filter((channel) => channel.id && channel.name).map((channel) => ({ id: channel.id!, name: channel.name!, isPrivate: Boolean(channel.is_private), isMember: Boolean(channel.is_member) })), nextCursor: result.response_metadata?.next_cursor || null };
}

export async function sendMessage(userId: string, input: { channelId: string; text: string; threadTs?: string }) {
  const verified = await verifyConnection(userId); if (!verified.healthy || !verified.workspace?.teamId) throw new Error("Slack authorization is unavailable or unhealthy.");
  const result = await api<PostMessageResponse>(await accessToken(userId), "chat.postMessage", { method: "POST", body: JSON.stringify({ channel: input.channelId, text: input.text, thread_ts: input.threadTs, unfurl_links: false, unfurl_media: false }) });
  const timestamp = result.ts || result.message?.ts;
  if (!result.channel || !timestamp) throw new Error("Slack message delivery returned no durable message reference.");
  return { workspace: verified.workspace, message: { channelId: result.channel, ts: timestamp, threadTs: input.threadTs || null } };
}

// Explicit user-triggered disconnect revokes the Slack token at the provider;
// company detachment itself remains a separate, tenant-local action.
export async function disconnect(userId: string) {
  const token = await storage.getOauthToken(userId, "slack"); if (!token) return { success: true, providerRevoked: true };
  let providerRevoked = false;
  try { await api<Record<string, unknown>>(decryptCredential(token.accessToken), "auth.revoke", { method: "POST" }); providerRevoked = true; } catch { /* Local deletion still removes EOS access. */ }
  await storage.deleteOauthToken(userId, "slack"); return { success: true, providerRevoked };
}
