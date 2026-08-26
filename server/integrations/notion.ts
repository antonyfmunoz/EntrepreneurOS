import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const NOTION_VERSION = "2026-03-11";
const NOTION_API = "https://api.notion.com/v1";

export const NOTION_TOOLS = [
  "notion.workspace.verify",
  "notion.workspace.search",
  "notion.page.read_snapshot",
] as const;

interface OAuthStatePayload {
  userId: string;
  expiresAt: number;
  nonce: string;
  returnTo: string;
}

type NotionWorkspaceMetadata = {
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string | null;
  botId?: string;
  ownerType?: string;
};

type NotionTokenResponse = {
  access_token: string;
  token_type?: string;
  refresh_token?: string | null;
  bot_id?: string;
  workspace_icon?: string | null;
  workspace_name?: string | null;
  workspace_id?: string;
  owner?: { type?: string };
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
  const clientId = process.env.NOTION_CLIENT_ID?.trim();
  const clientSecret = process.env.NOTION_CLIENT_SECRET?.trim();
  const redirectUri = process.env.NOTION_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/notion/callback";
  if (!clientId || !clientSecret) throw new Error("Notion OAuth credentials are not configured.");
  return { clientId, clientSecret, redirectUri };
}

function basicAuthorization(): string {
  const { clientId, clientSecret } = clientConfiguration();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function metadata(value: unknown): NotionWorkspaceMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return {
    workspaceId: typeof input.workspaceId === "string" ? input.workspaceId : undefined,
    workspaceName: typeof input.workspaceName === "string" ? input.workspaceName : undefined,
    workspaceIcon: typeof input.workspaceIcon === "string" || input.workspaceIcon === null ? input.workspaceIcon : undefined,
    botId: typeof input.botId === "string" ? input.botId : undefined,
    ownerType: typeof input.ownerType === "string" ? input.ownerType : undefined,
  };
}

async function notionFetch(path: string, init: RequestInit, timeoutMs = 8_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${NOTION_API}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function tokenRequest(body: Record<string, string>): Promise<NotionTokenResponse> {
  const response = await notionFetch("/oauth/token", {
    method: "POST",
    headers: {
      Authorization: basicAuthorization(),
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Notion authorization failed with ${response.status}.`);
  const result = await response.json() as NotionTokenResponse;
  if (!result.access_token) throw new Error("Notion authorization returned no access token.");
  return result;
}

export function createOAuthState(userId: string, now = Date.now(), returnTo = "/portfolios"): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: now + 10 * 60_000,
    nonce: randomBytes(16).toString("base64url"),
    returnTo: safeReturnTo(returnTo),
  })).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(`notion:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function readOAuthState(state: string, userId: string, now = Date.now()): OAuthStatePayload | null {
  try {
    const [payload, receivedSignature] = state.split(".");
    if (!payload || !receivedSignature) return null;
    // codeql[js/insufficient-password-hash] OAuth state is an HMAC signature, not a password hash.
    const expected = createHmac("sha256", stateSecret()).update(`notion:${payload}`).digest();
    const received = Buffer.from(receivedSignature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
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

export function getAuthUrl(userId: string, returnTo?: string): string {
  const { clientId, redirectUri } = clientConfiguration();
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("owner", "user");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", createOAuthState(userId, Date.now(), returnTo));
  return url.toString();
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  metadata: NotionWorkspaceMetadata;
}> {
  const { redirectUri } = clientConfiguration();
  const result = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token || undefined,
    tokenType: result.token_type,
    metadata: {
      workspaceId: result.workspace_id,
      workspaceName: result.workspace_name || undefined,
      workspaceIcon: result.workspace_icon,
      botId: result.bot_id,
      ownerType: result.owner?.type,
    },
  };
}

async function refreshAccessToken(userId: string): Promise<string> {
  const current = await storage.getOauthToken(userId, "notion");
  if (!current?.refreshToken) throw new Error("Notion authorization expired. Reconnect Notion.");
  const result = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptCredential(current.refreshToken) });
  await storage.upsertOauthToken({
    userId,
    provider: "notion",
    accessToken: encryptCredential(result.access_token),
    refreshToken: result.refresh_token ? encryptCredential(result.refresh_token) : current.refreshToken,
    tokenType: result.token_type || current.tokenType || undefined,
    scope: current.scope || undefined,
    metadata: metadata(current.metadata),
  });
  return result.access_token;
}

async function requestWithToken(userId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await storage.getOauthToken(userId, "notion");
  if (!token) throw new Error("Notion is not connected. Connect a workspace first.");
  const execute = (accessToken: string) => notionFetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const first = await execute(decryptCredential(token.accessToken));
  if (first.status !== 401 || !token.refreshToken) return first;
  return execute(await refreshAccessToken(userId));
}

export function isConfigured(): boolean {
  try {
    stateSecret();
    clientConfiguration();
    return credentialEncryptionConfigured();
  } catch {
    return false;
  }
}

export async function connectionSummary(userId: string): Promise<{
  configured: boolean;
  connected: boolean;
  workspace: NotionWorkspaceMetadata | null;
}> {
  if (!isConfigured()) return { configured: false, connected: false, workspace: null };
  const token = await storage.getOauthToken(userId, "notion");
  if (!token) return { configured: true, connected: false, workspace: null };
  try {
    decryptCredential(token.accessToken);
    return { configured: true, connected: true, workspace: metadata(token.metadata) };
  } catch {
    return { configured: true, connected: false, workspace: metadata(token.metadata) };
  }
}

export async function verifyConnection(userId: string): Promise<{
  configured: boolean;
  connected: boolean;
  healthy: boolean;
  workspace: NotionWorkspaceMetadata | null;
}> {
  const summary = await connectionSummary(userId);
  if (!summary.connected) return { ...summary, healthy: false };
  try {
    const response = await requestWithToken(userId, "/users/me");
    return { ...summary, healthy: response.ok };
  } catch {
    return { ...summary, healthy: false };
  }
}

export async function searchWorkspace(userId: string, query = "", pageSize = 20): Promise<Array<{ id: string; object: string; title: string; url: string | null; lastEditedTime: string | null }>> {
  if (!isConfigured()) throw new Error("Notion OAuth is not configured.");
  const response = await requestWithToken(userId, "/search", {
    method: "POST",
    body: JSON.stringify({ query, page_size: Math.min(50, Math.max(1, pageSize)), sort: { direction: "descending", timestamp: "last_edited_time" } }),
  });
  if (!response.ok) throw new Error(`Notion search failed with ${response.status}.`);
  const data = await response.json() as { results?: any[] };
  return (data.results || []).map((item: any) => {
    const titleParts = item.object === "page"
      ? (item.properties?.title?.title || item.properties?.Name?.title || [])
      : (item.title || []);
    return {
      id: item.id,
      object: item.object,
      title: titleParts.map((part: any) => part.plain_text || "").join("") || "Untitled",
      url: item.url || null,
      lastEditedTime: item.last_edited_time || null,
    };
  });
}

type NotionRichText = { plain_text?: string };
type NotionBlock = {
  id?: string;
  type?: string;
  has_children?: boolean;
  [key: string]: unknown;
};

function richTextValue(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => part && typeof part === "object" && typeof (part as NotionRichText).plain_text === "string"
      ? (part as NotionRichText).plain_text
      : "")
    .join("");
}

function blockText(block: NotionBlock): string {
  const body = block.type && block[block.type];
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = body as Record<string, unknown>;
  return richTextValue(value.rich_text || value.caption || value.title);
}

async function readBlockTree(
  userId: string,
  blockId: string,
  remaining: { value: number },
  depth = 0,
): Promise<{ lines: string[]; truncated: boolean }> {
  const lines: string[] = [];
  let cursor: string | undefined;
  let truncated = false;
  do {
    const pageSize = Math.min(100, remaining.value);
    if (pageSize < 1) return { lines, truncated: true };
    const query = new URLSearchParams({ page_size: String(pageSize) });
    if (cursor) query.set("start_cursor", cursor);
    const response = await requestWithToken(userId, `/blocks/${encodeURIComponent(blockId)}/children?${query}`);
    if (!response.ok) throw new Error(`Notion page content read failed with ${response.status}.`);
    const data = await response.json() as { results?: NotionBlock[]; has_more?: boolean; next_cursor?: string | null };
    for (const block of data.results || []) {
      remaining.value -= 1;
      const value = blockText(block).trim();
      if (value) lines.push(value);
      if (block.has_children && block.id && depth < 2 && remaining.value > 0) {
        const child = await readBlockTree(userId, block.id, remaining, depth + 1);
        lines.push(...child.lines);
        truncated ||= child.truncated;
      } else if (block.has_children) truncated = true;
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
    if (cursor && remaining.value <= 0) truncated = true;
  } while (cursor && remaining.value > 0);
  return { lines, truncated };
}

export async function readPageSnapshot(
  userId: string,
  pageId: string,
  maxBlocks = 200,
): Promise<{ pageId: string; url: string; title: string; lastEditedTime: string; boundedText: string; truncated: boolean }> {
  if (!isConfigured()) throw new Error("Notion OAuth is not configured.");
  const normalizedMax = Math.min(500, Math.max(1, Math.trunc(maxBlocks)));
  const response = await requestWithToken(userId, `/pages/${encodeURIComponent(pageId)}`);
  if (!response.ok) throw new Error(`Notion page read failed with ${response.status}.`);
  const page = await response.json() as any;
  const titleProperty = Object.values(page.properties || {}).find((property: any) => property?.type === "title") as any;
  const title = richTextValue(titleProperty?.title) || "Untitled";
  if (!page.id || !page.url || !page.last_edited_time)
    throw new Error("Notion page response is missing canonical identity or revision metadata.");
  const content = await readBlockTree(userId, page.id, { value: normalizedMax });
  const joined = content.lines.join("\n");
  const boundedText = joined.slice(0, 50_000);
  return {
    pageId: page.id,
    url: page.url,
    title,
    lastEditedTime: page.last_edited_time,
    boundedText,
    truncated: content.truncated || joined.length > boundedText.length,
  };
}

export async function revokeAuthorization(userId: string): Promise<{ providerRevoked: boolean }> {
  const token = await storage.getOauthToken(userId, "notion");
  if (!token) return { providerRevoked: true };
  let providerRevoked = false;
  try {
    const response = await notionFetch("/oauth/revoke", {
      method: "POST",
      headers: {
        Authorization: basicAuthorization(),
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({ token: decryptCredential(token.accessToken) }),
    });
    providerRevoked = response.ok;
    if (!providerRevoked && response.status === 400) {
      const body = await response.json().catch(() => ({})) as { code?: string };
      providerRevoked = body.code === "invalid_grant" || body.code === "invalid_token";
    }
  } catch {
    providerRevoked = false;
  }
  return { providerRevoked };
}

export async function disconnect(userId: string): Promise<{ success: true; providerRevoked: boolean }> {
  try {
    const result = await revokeAuthorization(userId);
    return { success: true, providerRevoked: result.providerRevoked };
  } finally {
    await storage.deleteOauthToken(userId, "notion");
  }
}
