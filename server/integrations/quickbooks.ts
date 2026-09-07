import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const AUTHORIZATION_ENDPOINT = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_ENDPOINT = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOCATION_ENDPOINT = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const API_ORIGIN = "https://quickbooks.api.intuit.com";
const ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";

export const QUICKBOOKS_ONLINE_SERVICES = ["Company file", "Ledger", "Invoices"] as const;
export const QUICKBOOKS_ONLINE_TOOLS = [
  "quickbooks.company.verify",
  "quickbooks.company.read",
  "quickbooks.invoices.read",
] as const;

type OAuthStatePayload = { userId: string; expiresAt: number; nonce: string; returnTo: string };
export type QuickBooksCompanyMetadata = {
  realmId?: string;
  companyName?: string;
  legalName?: string;
  country?: string;
  email?: string;
  fiscalYearStartMonth?: string;
};

type IntuitTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  x_refresh_token_expires_in?: number;
  scope?: string;
};

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

function clientConfiguration(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim();
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/quickbooks/callback";
  if (!clientId || !clientSecret) throw new Error("QuickBooks OAuth credentials are not configured.");
  return { clientId, clientSecret, redirectUri };
}

function basicAuthorization(): string {
  const { clientId, clientSecret } = clientConfiguration();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function metadata(value: unknown): QuickBooksCompanyMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const pick = (key: string) => typeof input[key] === "string" ? input[key] : undefined;
  return {
    realmId: pick("realmId"), companyName: pick("companyName"), legalName: pick("legalName"),
    country: pick("country"), email: pick("email"), fiscalYearStartMonth: pick("fiscalYearStartMonth"),
  };
}

function safeRealmId(value: string): string {
  if (!/^\d{3,32}$/.test(value)) throw new Error("QuickBooks did not return a valid company-file realm ID.");
  return value;
}

async function tokenRequest(body: Record<string, string>): Promise<IntuitTokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST", signal: AbortSignal.timeout(15_000),
    headers: { Authorization: basicAuthorization(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
  });
  const result = await response.json().catch(() => ({})) as IntuitTokenResponse;
  if (!response.ok || !result.access_token) throw new Error(`QuickBooks authorization failed with ${response.status}.`);
  return result;
}

function expiry(seconds?: number): Date | undefined {
  return Number.isFinite(seconds) && Number(seconds) > 0 ? new Date(Date.now() + Number(seconds) * 1_000) : undefined;
}

export function createOAuthState(userId: string, now = Date.now(), returnTo = "/portfolios"): string {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: now + 10 * 60_000, nonce: randomBytes(16).toString("base64url"), returnTo: safeReturnTo(returnTo) })).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(`quickbooks:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function readOAuthState(state: string, userId: string, now = Date.now()): OAuthStatePayload | null {
  try {
    const [payload, receivedSignature] = state.split(".");
    if (!payload || !receivedSignature) return null;
    const expected = createHmac("sha256", stateSecret()).update(`quickbooks:${payload}`).digest();
    const received = Buffer.from(receivedSignature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;
    if (decoded.userId !== userId || typeof decoded.expiresAt !== "number" || decoded.expiresAt < now) return null;
    return { userId, expiresAt: decoded.expiresAt, nonce: typeof decoded.nonce === "string" ? decoded.nonce : "", returnTo: safeReturnTo(decoded.returnTo) };
  } catch { return null; }
}

export function isConfigured(): boolean {
  try { stateSecret(); clientConfiguration(); return credentialEncryptionConfigured(); } catch { return false; }
}

export function getAuthUrl(userId: string, returnTo?: string): string {
  const { clientId, redirectUri } = clientConfiguration();
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ACCOUNTING_SCOPE);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", createOAuthState(userId, Date.now(), returnTo));
  return url.toString();
}

export async function exchangeCode(code: string, realmId: string): Promise<{ accessToken: string; refreshToken?: string; tokenType?: string; expiresAt?: Date; scope: string; metadata: QuickBooksCompanyMetadata }> {
  const { redirectUri } = clientConfiguration();
  const result = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  return { accessToken: result.access_token || "", refreshToken: result.refresh_token, tokenType: result.token_type, expiresAt: expiry(result.expires_in), scope: result.scope || ACCOUNTING_SCOPE, metadata: { realmId: safeRealmId(realmId) } };
}

async function refreshAccessToken(userId: string): Promise<string> {
  const current = await storage.getOauthToken(userId, "quickbooks");
  if (!current?.refreshToken) throw new Error("QuickBooks authorization expired. Reconnect the company file.");
  const result = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptCredential(current.refreshToken) });
  await storage.upsertOauthToken({ userId, provider: "quickbooks", accessToken: encryptCredential(result.access_token || ""), refreshToken: result.refresh_token ? encryptCredential(result.refresh_token) : current.refreshToken, tokenType: result.token_type || current.tokenType || undefined, expiresAt: expiry(result.expires_in), scope: result.scope || current.scope || ACCOUNTING_SCOPE, metadata: metadata(current.metadata) });
  return result.access_token || "";
}

async function requestWithToken(userId: string, path: string): Promise<Response> {
  const token = await storage.getOauthToken(userId, "quickbooks");
  if (!token) throw new Error("QuickBooks is not connected. Connect a company file first.");
  const execute = (accessToken: string) => fetch(new URL(path, API_ORIGIN), { signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  let access = decryptCredential(token.accessToken);
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now() + 60_000) access = await refreshAccessToken(userId);
  const first = await execute(access);
  if (first.status !== 401 || !token.refreshToken) return first;
  return execute(await refreshAccessToken(userId));
}

export async function connectionSummary(userId: string): Promise<{ configured: boolean; connected: boolean; company: QuickBooksCompanyMetadata | null }> {
  if (!isConfigured()) return { configured: false, connected: false, company: null };
  const token = await storage.getOauthToken(userId, "quickbooks");
  if (!token) return { configured: true, connected: false, company: null };
  try { decryptCredential(token.accessToken); return { configured: true, connected: true, company: metadata(token.metadata) }; }
  catch { return { configured: true, connected: false, company: metadata(token.metadata) }; }
}

export async function verifyConnection(userId: string): Promise<{ configured: boolean; connected: boolean; healthy: boolean; company: QuickBooksCompanyMetadata | null }> {
  const summary = await connectionSummary(userId);
  const realmId = summary.company?.realmId;
  if (!summary.connected || !realmId) return { ...summary, healthy: false };
  try {
    const response = await requestWithToken(userId, `/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=75`);
    if (!response.ok) return { ...summary, healthy: false };
    const payload = await response.json() as { CompanyInfo?: Record<string, unknown> };
    const info = payload.CompanyInfo || {};
    if (String(info.Id || "") !== realmId) return { ...summary, healthy: false };
    const company: QuickBooksCompanyMetadata = {
      realmId,
      companyName: typeof info.CompanyName === "string" ? info.CompanyName : summary.company?.companyName,
      legalName: typeof info.LegalName === "string" ? info.LegalName : undefined,
      country: typeof info.Country === "string" ? info.Country : undefined,
      email: typeof (info.CompanyEmailAddr as any)?.Address === "string" ? (info.CompanyEmailAddr as any).Address : undefined,
      fiscalYearStartMonth: typeof info.FiscalYearStartMonth === "string" ? info.FiscalYearStartMonth : undefined,
    };
    const token = await storage.getOauthToken(userId, "quickbooks");
    if (token) await storage.upsertOauthToken({ userId, provider: "quickbooks", accessToken: token.accessToken, refreshToken: token.refreshToken || undefined, tokenType: token.tokenType || undefined, expiresAt: token.expiresAt || undefined, scope: token.scope || ACCOUNTING_SCOPE, metadata: company });
    return { configured: true, connected: true, healthy: true, company };
  } catch { return { ...summary, healthy: false }; }
}

export async function disconnect(userId: string): Promise<{ success: true; providerRevoked: boolean }> {
  const token = await storage.getOauthToken(userId, "quickbooks");
  let providerRevoked = false;
  if (token) {
    try {
      const response = await fetch(REVOCATION_ENDPOINT, { method: "POST", signal: AbortSignal.timeout(15_000), headers: { Authorization: basicAuthorization(), "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ token: decryptCredential(token.refreshToken || token.accessToken) }) });
      providerRevoked = response.ok || response.status === 400;
    } catch { providerRevoked = false; }
  }
  await storage.deleteOauthToken(userId, "quickbooks");
  return { success: true, providerRevoked };
}
