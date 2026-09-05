import { hkdfSync, randomBytes, webcrypto } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";
const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

type OAuthState = { userId: string; expiresAt: number; nonce: string; returnTo: string };
type TokenResponse = { access_token?: string; refresh_token?: string; token_type?: string; expires_in?: number; x_refresh_token_expires_in?: number };
type CompanyInfo = { Id?: string; CompanyName?: string; LegalName?: string; CompanyAddr?: { City?: string; CountrySubDivisionCode?: string; Country?: string } };

function safeReturnTo(value?: string): string {
  if (!value) return "/portfolios";
  if (/^\/company\/[1-9]\d*(?:#systems)?$/.test(value)) return value;
  if (/^\/portfolios(?:\/[1-9]\d*)?$/.test(value)) return value;
  return "/portfolios";
}

function stateSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters for QuickBooks OAuth state signing.");
  return secret;
}

async function stateSigningKey(): Promise<CryptoKey> {
  const keyMaterial = Buffer.from(hkdfSync(
    "sha256",
    stateSecret(),
    "entrepreneuros/quickbooks-oauth-state/v1",
    "authorization-response-integrity",
    32,
  ));
  return webcrypto.subtle.importKey("raw", keyMaterial, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function stateMessage(payload: string): Uint8Array {
  return new TextEncoder().encode(`quickbooks:${payload}`);
}

async function signState(payload: string): Promise<string> {
  const signature = await webcrypto.subtle.sign("HMAC", await stateSigningKey(), stateMessage(payload));
  return Buffer.from(signature).toString("base64url");
}

function configuration() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim();
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/quickbooks/callback";
  const environment = process.env.QUICKBOOKS_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
  if (!clientId || !clientSecret) throw new Error("QuickBooks OAuth credentials are not configured.");
  return { clientId, clientSecret, redirectUri, environment } as const;
}

function basicAuthorization() {
  const { clientId, clientSecret } = configuration();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function apiBase() { return configuration().environment === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com"; }

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(TOKEN_URL, { method: "POST", headers: { Authorization: basicAuthorization(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: controller.signal });
    if (!response.ok) throw new Error(`QuickBooks authorization failed with ${response.status}.`);
    const result = await response.json() as TokenResponse;
    if (!result.access_token) throw new Error("QuickBooks authorization returned no access token.");
    return result;
  } finally { clearTimeout(timeout); }
}

function expiry(seconds?: number): Date | undefined { return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(Date.now() + Math.max(1, seconds) * 1000) : undefined; }

function metadata(value: unknown): { realmId?: string; companyName?: string; legalName?: string; environment?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return {
    realmId: typeof input.realmId === "string" ? input.realmId : undefined,
    companyName: typeof input.companyName === "string" ? input.companyName : undefined,
    legalName: typeof input.legalName === "string" ? input.legalName : undefined,
    environment: input.environment === "sandbox" ? "sandbox" : input.environment === "production" ? "production" : undefined,
  };
}

export const QUICKBOOKS_TOOLS = ["quickbooks.company.verify", "quickbooks.invoice.list_open", "quickbooks.invoice.create"] as const;

export async function createOAuthState(userId: string, now = Date.now(), returnTo = "/portfolios"): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: now + 10 * 60_000, nonce: randomBytes(16).toString("base64url"), returnTo: safeReturnTo(returnTo) })).toString("base64url");
  const signature = await signState(payload);
  return `${payload}.${signature}`;
}

export async function readOAuthState(state: string, userId: string, now = Date.now()): Promise<OAuthState | null> {
  try {
    const [payload, receivedSignature] = state.split(".");
    if (!payload || !receivedSignature) return null;
    const received = Buffer.from(receivedSignature, "base64url");
    if (!(await webcrypto.subtle.verify("HMAC", await stateSigningKey(), received, stateMessage(payload)))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<OAuthState>;
    if (decoded.userId !== userId || typeof decoded.expiresAt !== "number" || decoded.expiresAt < now) return null;
    return { userId, expiresAt: decoded.expiresAt, nonce: typeof decoded.nonce === "string" ? decoded.nonce : "", returnTo: safeReturnTo(decoded.returnTo) };
  } catch { return null; }
}

export function isConfigured(): boolean { try { stateSecret(); configuration(); return credentialEncryptionConfigured(); } catch { return false; } }

export async function getAuthUrl(userId: string, returnTo?: string): Promise<string> {
  const { clientId, redirectUri } = configuration();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId); url.searchParams.set("redirect_uri", redirectUri); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", ACCOUNTING_SCOPE); url.searchParams.set("state", await createOAuthState(userId, Date.now(), returnTo));
  return url.toString();
}

export async function exchangeCode(code: string, realmId: string) {
  if (!/^\d{3,30}$/.test(realmId)) throw new Error("QuickBooks authorization returned an invalid company realm identifier.");
  const { redirectUri, environment } = configuration();
  const result = await tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));
  return { accessToken: result.access_token!, refreshToken: result.refresh_token, tokenType: result.token_type || "Bearer", expiresAt: expiry(result.expires_in), metadata: { realmId, environment } };
}

async function refreshAccessToken(userId: string): Promise<string> {
  const token = await storage.getOauthToken(userId, "quickbooks");
  if (!token?.refreshToken) throw new Error("QuickBooks authorization expired. Reconnect the company in Systems.");
  const result = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptCredential(token.refreshToken) }));
  await storage.upsertOauthToken({ userId, provider: "quickbooks", accessToken: encryptCredential(result.access_token!), refreshToken: result.refresh_token ? encryptCredential(result.refresh_token) : token.refreshToken, tokenType: result.token_type || token.tokenType || "Bearer", expiresAt: expiry(result.expires_in), scope: token.scope || ACCOUNTING_SCOPE, metadata: metadata(token.metadata) });
  return result.access_token!;
}

async function accessToken(userId: string): Promise<string> {
  const token = await storage.getOauthToken(userId, "quickbooks");
  if (!token) throw new Error("QuickBooks is not connected. Connect the accounting company first.");
  if (token.expiresAt && new Date(token.expiresAt) <= new Date()) return refreshAccessToken(userId);
  return decryptCredential(token.accessToken);
}

async function request(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const call = async (token: string) => {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try { return await fetch(`${apiBase()}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) }, signal: controller.signal }); }
    finally { clearTimeout(timeout); }
  };
  const first = await call(await accessToken(userId));
  return first.status === 401 ? call(await refreshAccessToken(userId)) : first;
}

export async function connectionSummary(userId: string) {
  if (!isConfigured()) return { configured: false, connected: false, company: null };
  const token = await storage.getOauthToken(userId, "quickbooks");
  if (!token) return { configured: true, connected: false, company: null };
  try { decryptCredential(token.accessToken); const current = metadata(token.metadata); return { configured: true, connected: true, company: current.realmId ? current : null }; }
  catch { return { configured: true, connected: false, company: null }; }
}

export async function verifyConnection(userId: string) {
  const summary = await connectionSummary(userId);
  if (!summary.connected || !summary.company?.realmId) return { ...summary, healthy: false };
  try {
    const realmId = summary.company.realmId;
    const response = await request(userId, `/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}?minorversion=75`);
    if (!response.ok) return { ...summary, healthy: false };
    const body = await response.json() as { CompanyInfo?: CompanyInfo };
    const company = body.CompanyInfo;
    if (!company?.Id || company.Id !== realmId) return { ...summary, healthy: false };
    const next = { realmId, companyName: company.CompanyName || undefined, legalName: company.LegalName || undefined, environment: summary.company.environment };
    const token = await storage.getOauthToken(userId, "quickbooks");
    if (token) await storage.upsertOauthToken({ userId, provider: "quickbooks", accessToken: token.accessToken, refreshToken: token.refreshToken || undefined, tokenType: token.tokenType || undefined, expiresAt: token.expiresAt || undefined, scope: token.scope || ACCOUNTING_SCOPE, metadata: next });
    return { configured: true, connected: true, healthy: true, company: next };
  } catch { return { ...summary, healthy: false }; }
}

export async function listOpenInvoices(userId: string, maxResults = 25) {
  const verified = await verifyConnection(userId); if (!verified.healthy || !verified.company?.realmId) throw new Error("QuickBooks authorization is unavailable or unhealthy.");
  const query = `SELECT Id, DocNumber, TxnDate, DueDate, Balance, TotalAmt, CustomerRef FROM Invoice WHERE Balance > '0' ORDERBY DueDate MAXRESULTS ${Math.min(100, Math.max(1, Math.trunc(maxResults)))}`;
  const response = await request(userId, `/v3/company/${encodeURIComponent(verified.company.realmId)}/query?query=${encodeURIComponent(query)}&minorversion=75`);
  if (!response.ok) throw new Error(`QuickBooks invoice query failed with ${response.status}.`);
  const body = await response.json() as { QueryResponse?: { Invoice?: Array<Record<string, unknown>> } };
  return { company: verified.company, invoices: (body.QueryResponse?.Invoice || []).map((invoice) => ({ id: String(invoice.Id || ""), docNumber: typeof invoice.DocNumber === "string" ? invoice.DocNumber : null, txnDate: typeof invoice.TxnDate === "string" ? invoice.TxnDate : null, dueDate: typeof invoice.DueDate === "string" ? invoice.DueDate : null, balance: typeof invoice.Balance === "number" ? invoice.Balance : null, totalAmount: typeof invoice.TotalAmt === "number" ? invoice.TotalAmt : null, customer: invoice.CustomerRef && typeof invoice.CustomerRef === "object" ? invoice.CustomerRef : null })) };
}

export async function createInvoice(userId: string, input: { customerId: string; lineItems: Array<{ itemId: string; amount: number; description?: string; quantity?: number; unitPrice?: number }>; dueDate?: string; docNumber?: string; privateNote?: string }) {
  const verified = await verifyConnection(userId); if (!verified.healthy || !verified.company?.realmId) throw new Error("QuickBooks authorization is unavailable or unhealthy.");
  const payload = { CustomerRef: { value: input.customerId }, Line: input.lineItems.map((item) => ({ Amount: item.amount, Description: item.description || undefined, DetailType: "SalesItemLineDetail", SalesItemLineDetail: { ItemRef: { value: item.itemId }, Qty: item.quantity, UnitPrice: item.unitPrice } })), DueDate: input.dueDate, DocNumber: input.docNumber, PrivateNote: input.privateNote };
  const response = await request(userId, `/v3/company/${encodeURIComponent(verified.company.realmId)}/invoice?minorversion=75`, { method: "POST", body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`QuickBooks invoice creation failed with ${response.status}.`);
  const body = await response.json() as { Invoice?: { Id?: string; DocNumber?: string; TxnDate?: string; DueDate?: string; TotalAmt?: number; Balance?: number; CustomerRef?: unknown } };
  if (!body.Invoice?.Id) throw new Error("QuickBooks invoice creation returned no durable invoice reference.");
  return { company: verified.company, invoice: { id: body.Invoice.Id, docNumber: body.Invoice.DocNumber || null, txnDate: body.Invoice.TxnDate || null, dueDate: body.Invoice.DueDate || null, totalAmount: body.Invoice.TotalAmt ?? null, balance: body.Invoice.Balance ?? null, customer: body.Invoice.CustomerRef || null } };
}

export async function disconnect(userId: string) { await storage.deleteOauthToken(userId, "quickbooks"); return { success: true, providerRevoked: false }; }
