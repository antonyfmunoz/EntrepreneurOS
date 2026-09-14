import { hkdfSync, randomBytes, webcrypto } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const OAUTH_BASE_URL = "https://account.docusign.com";
const SCOPES = ["signature", "extended", "offline_access"] as const;

type OAuthState = { userId: string; expiresAt: number; nonce: string; returnTo: string };
type TokenResponse = { access_token?: string; refresh_token?: string; token_type?: string; expires_in?: number; scope?: string };
type UserInfoAccount = { account_id?: string; account_name?: string; base_uri?: string; is_default?: boolean };
type UserInfo = { sub?: string; name?: string; email?: string; accounts?: UserInfoAccount[] };
type AccountMetadata = { accountId?: string; accountName?: string; baseUri?: string; userId?: string; userName?: string; email?: string; grantedScopes?: string[] };

function safeReturnTo(value?: string): string {
  if (/^\/company\/[1-9]\d*#systems$/.test(value || "")) return value!;
  if (/^\/portfolios(?:\/[1-9]\d*)?$/.test(value || "")) return value!;
  return "/portfolios";
}

function configuration() {
  const clientId = process.env.DOCUSIGN_CLIENT_ID?.trim();
  const clientSecret = process.env.DOCUSIGN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.DOCUSIGN_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/docusign/callback";
  const oauthBaseUrl = (process.env.DOCUSIGN_OAUTH_BASE_URL?.trim() || OAUTH_BASE_URL).replace(/\/$/, "");
  if (!clientId || !clientSecret) throw new Error("DocuSign OAuth credentials are not configured.");
  if (!/^https:\/\//.test(oauthBaseUrl) || !/^https:\/\//.test(redirectUri) && !/^http:\/\/localhost(?::\d+)?\//.test(redirectUri)) throw new Error("DocuSign OAuth URLs must be HTTPS, except a localhost development callback.");
  return { clientId, clientSecret, redirectUri, oauthBaseUrl } as const;
}

function stateSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters for DocuSign OAuth state signing.");
  return secret;
}

async function stateSigningKey(): Promise<CryptoKey> {
  const keyMaterial = Buffer.from(hkdfSync("sha256", stateSecret(), "entrepreneuros/docusign-oauth-state/v1", "authorization-response-integrity", 32));
  return webcrypto.subtle.importKey("raw", keyMaterial, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function stateMessage(payload: string): Uint8Array { return new TextEncoder().encode(`docusign:${payload}`); }

async function signState(payload: string): Promise<string> {
  return Buffer.from(await webcrypto.subtle.sign("HMAC", await stateSigningKey(), stateMessage(payload))).toString("base64url");
}

export async function createOAuthState(userId: string, now = Date.now(), returnTo = "/portfolios"): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: now + 10 * 60_000, nonce: randomBytes(16).toString("base64url"), returnTo: safeReturnTo(returnTo) })).toString("base64url");
  return `${payload}.${await signState(payload)}`;
}

async function readState(state: string, now = Date.now()): Promise<OAuthState | null> {
  try {
    const [payload, signature] = state.split(".");
    if (!payload || !signature) return null;
    if (!(await webcrypto.subtle.verify("HMAC", await stateSigningKey(), Buffer.from(signature, "base64url"), stateMessage(payload)))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OAuthState>;
    if (typeof decoded.userId !== "string" || !decoded.userId || typeof decoded.expiresAt !== "number" || decoded.expiresAt < now) return null;
    return { userId: decoded.userId, expiresAt: decoded.expiresAt, nonce: typeof decoded.nonce === "string" ? decoded.nonce : "", returnTo: safeReturnTo(decoded.returnTo) };
  } catch { return null; }
}

export async function readOAuthState(state: string, userId: string, now = Date.now()): Promise<OAuthState | null> {
  const decoded = await readState(state, now);
  return decoded?.userId === userId ? decoded : null;
}

/** A signed, expiring state is sufficient to restore an interrupted external-browser consent callback. */
export async function readOAuthStateFromCallback(state: string, now = Date.now()): Promise<OAuthState | null> { return readState(state, now); }

function basicAuthorization() {
  const { clientId, clientSecret } = configuration();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function expiry(seconds?: number): Date | undefined { return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(Date.now() + Math.max(1, seconds) * 1000) : undefined; }

function metadata(value: unknown): AccountMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  return {
    accountId: typeof data.accountId === "string" ? data.accountId : undefined,
    accountName: typeof data.accountName === "string" ? data.accountName : undefined,
    baseUri: typeof data.baseUri === "string" ? data.baseUri : undefined,
    userId: typeof data.userId === "string" ? data.userId : undefined,
    userName: typeof data.userName === "string" ? data.userName : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
    grantedScopes: Array.isArray(data.grantedScopes) ? data.grantedScopes.filter((scope): scope is string => typeof scope === "string") : undefined,
  };
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const { oauthBaseUrl } = configuration();
  const response = await fetch(`${oauthBaseUrl}/oauth/token`, { method: "POST", headers: { Authorization: basicAuthorization(), "content-type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`DocuSign authorization failed with ${response.status}.`);
  const result = await response.json() as TokenResponse;
  if (!result.access_token) throw new Error("DocuSign authorization returned no access token.");
  return result;
}

async function userInfo(token: string): Promise<UserInfo> {
  const { oauthBaseUrl } = configuration();
  const response = await fetch(`${oauthBaseUrl}/oauth/userinfo`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`DocuSign account identity request failed with ${response.status}.`);
  return await response.json() as UserInfo;
}

function selectedAccount(info: UserInfo): Required<Pick<UserInfoAccount, "account_id" | "base_uri">> & UserInfoAccount {
  const candidates = (info.accounts || []).filter((account) => typeof account.account_id === "string" && typeof account.base_uri === "string" && /^https:\/\//.test(account.base_uri));
  const selected = candidates.find((account) => account.is_default) || (candidates.length === 1 ? candidates[0] : null);
  if (!selected?.account_id || !selected.base_uri) throw new Error("DocuSign returned multiple accounts without a default account. Set the intended account as default in DocuSign, then reconnect.");
  return { ...selected, base_uri: selected.base_uri.replace(/\/restapi\/?$/, "").replace(/\/$/, "") } as Required<Pick<UserInfoAccount, "account_id" | "base_uri">> & UserInfoAccount;
}

export function isConfigured(): boolean { try { stateSecret(); configuration(); return credentialEncryptionConfigured(); } catch { return false; } }

export async function getAuthUrl(userId: string, returnTo?: string): Promise<string> {
  const { clientId, redirectUri, oauthBaseUrl } = configuration();
  const url = new URL(`${oauthBaseUrl}/oauth/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", await createOAuthState(userId, Date.now(), returnTo));
  return url.toString();
}

export async function exchangeCode(code: string) {
  const { redirectUri } = configuration();
  const result = await tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));
  const info = await userInfo(result.access_token!);
  const account = selectedAccount(info);
  const grantedScopes = (result.scope || SCOPES.join(" ")).split(/\s+/).filter(Boolean);
  return { accessToken: result.access_token!, refreshToken: result.refresh_token, tokenType: result.token_type || "Bearer", expiresAt: expiry(result.expires_in), scope: grantedScopes.join(" "), metadata: { accountId: account.account_id, accountName: account.account_name, baseUri: account.base_uri.replace(/\/$/, ""), userId: info.sub, userName: info.name, email: info.email, grantedScopes } satisfies AccountMetadata };
}

async function refreshAccessToken(userId: string): Promise<string> {
  const stored = await storage.getOauthToken(userId, "docusign");
  if (!stored?.refreshToken) throw new Error("DocuSign authorization expired. Reconnect it in Systems.");
  const result = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptCredential(stored.refreshToken) }));
  await storage.upsertOauthToken({ userId, provider: "docusign", accessToken: encryptCredential(result.access_token!), refreshToken: result.refresh_token ? encryptCredential(result.refresh_token) : stored.refreshToken, tokenType: result.token_type || stored.tokenType || "Bearer", expiresAt: expiry(result.expires_in), scope: result.scope || stored.scope || SCOPES.join(" "), metadata: metadata(stored.metadata) });
  return result.access_token!;
}

export async function accessToken(userId: string): Promise<string> {
  const stored = await storage.getOauthToken(userId, "docusign");
  if (!stored) throw new Error("DocuSign is not connected. Connect the company signing account first.");
  if (stored.expiresAt && new Date(stored.expiresAt) <= new Date()) return refreshAccessToken(userId);
  return decryptCredential(stored.accessToken);
}

async function request(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const current = metadata((await storage.getOauthToken(userId, "docusign"))?.metadata);
  if (!current.baseUri || !current.accountId) throw new Error("DocuSign authorization has no selected account. Reconnect it in Systems.");
  const baseUri = current.baseUri;
  const accountId = current.accountId;
  const call = async (token: string) => fetch(`${baseUri}/restapi/v2.1/accounts/${encodeURIComponent(accountId)}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) }, signal: AbortSignal.timeout(20_000) });
  const first = await call(await accessToken(userId));
  return first.status === 401 ? call(await refreshAccessToken(userId)) : first;
}

export async function connectionSummary(userId: string) {
  if (!isConfigured()) return { configured: false, connected: false, account: null };
  const stored = await storage.getOauthToken(userId, "docusign");
  if (!stored) return { configured: true, connected: false, account: null };
  try { decryptCredential(stored.accessToken); const account = metadata(stored.metadata); return { configured: true, connected: Boolean(account.accountId && account.baseUri), account }; }
  catch { return { configured: true, connected: false, account: null }; }
}

export async function verifyConnection(userId: string) {
  const summary = await connectionSummary(userId);
  if (!summary.connected || !summary.account?.accountId) return { ...summary, healthy: false };
  try {
    const response = await request(userId, "");
    if (!response.ok) return { ...summary, healthy: false };
    const account = await response.json() as { accountId?: unknown; accountName?: unknown };
    if (typeof account.accountId !== "string" || account.accountId !== summary.account.accountId) return { ...summary, healthy: false };
    const next = { ...summary.account, accountName: typeof account.accountName === "string" ? account.accountName : summary.account.accountName };
    const stored = await storage.getOauthToken(userId, "docusign");
    if (stored) await storage.upsertOauthToken({ userId, provider: "docusign", accessToken: stored.accessToken, refreshToken: stored.refreshToken || undefined, tokenType: stored.tokenType || undefined, expiresAt: stored.expiresAt || undefined, scope: stored.scope || SCOPES.join(" "), metadata: next });
    return { configured: true, connected: true, healthy: true, account: next };
  } catch { return { ...summary, healthy: false }; }
}

export async function disconnect(userId: string) { await storage.deleteOauthToken(userId, "docusign"); return { success: true, providerRevoked: false }; }

export async function sendEnvelope(userId: string, envelope: unknown) {
  const response = await request(userId, "/envelopes", { method: "POST", body: JSON.stringify(envelope) });
  if (!response.ok) throw new Error(`DocuSign rejected the approved envelope request with ${response.status}.`);
  return await response.json() as Record<string, unknown>;
}

export async function voidEnvelope(userId: string, envelopeId: string, rationale: string) {
  const response = await request(userId, `/envelopes/${encodeURIComponent(envelopeId)}`, { method: "PUT", body: JSON.stringify({ status: "voided", voidedReason: rationale }) });
  if (!response.ok) throw new Error(`DocuSign rejected the approved void request with ${response.status}.`);
  return await response.json() as Record<string, unknown>;
}
