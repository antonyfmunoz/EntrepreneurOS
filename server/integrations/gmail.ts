import { google } from "googleapis";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { storage } from "../storage";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../security/credential-encryption";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export const GOOGLE_WORKSPACE_SERVICES = ["Gmail", "Calendar", "Drive"] as const;

export const GOOGLE_WORKSPACE_TOOLS = [
  "google.workspace.health.verify",
  "google.workspace.authorization.revoke",
  "google.calendar.upcoming.read",
  "google.calendar.create_candidate_event_with_local_approval",
  "google.calendar.cancel_candidate_event_with_local_approval",
  "google.drive.recent_metadata.read",
  "gmail.send_with_local_approval",
  "gmail.send_candidate_portal_invitation_with_local_approval",
] as const;

export function scopeCoverage(grantedScopes: string[]): Record<(typeof GOOGLE_WORKSPACE_SERVICES)[number], boolean> {
  const granted = new Set(grantedScopes);
  return {
    Gmail: granted.has("https://www.googleapis.com/auth/gmail.send") || granted.has("https://mail.google.com/"),
    Calendar: granted.has("https://www.googleapis.com/auth/calendar.readonly") || granted.has("https://www.googleapis.com/auth/calendar.events") || granted.has("https://www.googleapis.com/auth/calendar"),
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
  for (const [name, value] of Object.entries({ to: params.to, subject: params.subject, cc: params.cc, bcc: params.bcc })) {
    if (value && /[\r\n]/.test(value)) throw new Error(`Gmail ${name} header contains an invalid line break.`);
  }
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

export function calendarWriteScopeCoverage(grantedScopes: string[]): boolean {
  const granted = new Set(grantedScopes);
  return granted.has("https://www.googleapis.com/auth/calendar.events") || granted.has("https://www.googleapis.com/auth/calendar");
}

export function mailboxWatchScopeCoverage(grantedScopes: string[]): boolean {
  const granted = new Set(grantedScopes);
  return granted.has("https://www.googleapis.com/auth/gmail.readonly") || granted.has("https://www.googleapis.com/auth/gmail.modify") || granted.has("https://mail.google.com/");
}

export function driveWatchScopeCoverage(grantedScopes: string[]): boolean {
  return scopeCoverage(grantedScopes).Drive;
}

export function calendarWatchScopeCoverage(grantedScopes: string[]): boolean {
  return scopeCoverage(grantedScopes).Calendar;
}

async function workspaceOAuth(userId: string) {
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

async function assertGoogleScope(userId: string, service: "Drive" | "Calendar"): Promise<void> {
  const token = await storage.getOauthToken(userId, "gmail");
  const granted = (token?.scope || "").split(/\s+/).filter(Boolean);
  const covered = service === "Drive" ? driveWatchScopeCoverage(granted) : calendarWatchScopeCoverage(granted);
  if (!token || !covered) throw new Error(`The connected Google authorization does not include the required ${service} scope. Reconnect Google Workspace before starting a watch.`);
}

export type DriveMetadataChange = {
  resourceId: string;
  resourceState: "active" | "deleted";
  providerRevision: string;
  title: string;
  providerUrl: string;
  metadata: Record<string, unknown>;
};

export async function getDriveStartPageToken(userId: string, expectedEmailAddress?: string): Promise<{ emailAddress: string; cursor: string }> {
  await assertGoogleScope(userId, "Drive");
  const auth = await workspaceOAuth(userId);
  const drive = google.drive({ version: "v3", auth });
  const about = await drive.about.get({ fields: "user(emailAddress)" });
  const emailAddress = about.data.user?.emailAddress || "";
  if (!emailAddress || (expectedEmailAddress && emailAddress.toLowerCase() !== expectedEmailAddress.toLowerCase()))
    throw new Error("The authorized Google Drive account does not match the expected provider account.");
  const token = await drive.changes.getStartPageToken({});
  if (!token.data.startPageToken) throw new Error("Google Drive returned an incomplete changes cursor receipt.");
  return { emailAddress, cursor: token.data.startPageToken };
}

export async function startDriveChangesWatch(userId: string, input: { channelId: string; channelToken: string; callbackUrl: string; pageToken: string; expectedEmailAddress?: string }): Promise<{ emailAddress: string; channelId: string; resourceId: string; cursor: string; expiresAt: Date }> {
  const identity = await getDriveStartPageToken(userId, input.expectedEmailAddress);
  const auth = await workspaceOAuth(userId);
  const watch = await google.drive({ version: "v3", auth }).changes.watch({
    pageToken: input.pageToken,
    requestBody: { id: input.channelId, type: "web_hook", address: input.callbackUrl, token: input.channelToken },
  });
  if (!watch.data.id || !watch.data.resourceId || !watch.data.expiration) throw new Error("Google Drive returned an incomplete channel receipt.");
  return { emailAddress: identity.emailAddress, channelId: watch.data.id, resourceId: watch.data.resourceId, cursor: input.pageToken, expiresAt: new Date(Number(watch.data.expiration)) };
}

export async function listDriveChanges(userId: string, pageToken: string, maxPages = 25): Promise<{ nextCursor: string; changes: DriveMetadataChange[]; truncated: boolean }> {
  if (!pageToken.trim()) throw new Error("A canonical Google Drive changes cursor is required.");
  const auth = await workspaceOAuth(userId);
  const drive = google.drive({ version: "v3", auth });
  const changes: DriveMetadataChange[] = [];
  let cursor = pageToken;
  let pages = 0;
  let newStartPageToken = "";
  do {
    const result = await drive.changes.list({
      pageToken: cursor,
      pageSize: 100,
      includeRemoved: true,
      restrictToMyDrive: false,
      fields: "nextPageToken,newStartPageToken,changes(fileId,removed,time,file(id,name,mimeType,modifiedTime,version,webViewLink,trashed,owners(emailAddress),driveId))",
    });
    for (const change of result.data.changes || []) {
      if (!change.fileId) continue;
      const file = change.file;
      const deleted = Boolean(change.removed || file?.trashed);
      changes.push({
        resourceId: change.fileId,
        resourceState: deleted ? "deleted" : "active",
        providerRevision: String(file?.version || file?.modifiedTime || change.time || "unknown"),
        title: file?.name || (deleted ? "Deleted Drive item" : "Untitled Drive item"),
        providerUrl: file?.webViewLink || "",
        metadata: { mimeType: file?.mimeType || null, modifiedTime: file?.modifiedTime || null, version: file?.version || null, trashed: Boolean(file?.trashed), driveId: file?.driveId || null, removed: Boolean(change.removed), ownerEmails: (file?.owners || []).map((owner) => owner.emailAddress).filter(Boolean) },
      });
    }
    pages += 1;
    newStartPageToken = result.data.newStartPageToken || newStartPageToken;
    if (!result.data.nextPageToken) break;
    cursor = result.data.nextPageToken;
  } while (pages < Math.min(25, Math.max(1, maxPages)));
  if (!newStartPageToken) throw new Error("Google Drive reconciliation exceeded its bounded page window or returned no durable cursor.");
  return { nextCursor: newStartPageToken, changes: changes.slice(0, 500), truncated: changes.length > 500 };
}

export type CalendarMetadataChange = {
  resourceId: string;
  resourceState: "active" | "deleted";
  providerRevision: string;
  title: string;
  providerUrl: string;
  metadata: Record<string, unknown>;
};

export async function getCalendarSyncToken(userId: string, calendarId: string): Promise<string> {
  await assertGoogleScope(userId, "Calendar");
  const auth = await workspaceOAuth(userId);
  const calendar = google.calendar({ version: "v3", auth });
  let pageToken: string | undefined;
  for (let pages = 0; pages < 25; pages += 1) {
    const result = await calendar.events.list({ calendarId, maxResults: 2500, pageToken, showDeleted: true, singleEvents: false });
    if (result.data.nextPageToken) { pageToken = result.data.nextPageToken; continue; }
    if (!result.data.nextSyncToken) throw new Error("Google Calendar returned no durable sync token.");
    return result.data.nextSyncToken;
  }
  throw new Error("Google Calendar initial synchronization exceeded its bounded page window.");
}

export async function startCalendarWatch(userId: string, input: { channelId: string; channelToken: string; callbackUrl: string; calendarId: string; expectedEmailAddress?: string }): Promise<{ emailAddress: string; channelId: string; resourceId: string; cursor: string; expiresAt: Date }> {
  await assertGoogleScope(userId, "Calendar");
  const auth = await workspaceOAuth(userId);
  const profile = await google.gmail({ version: "v1", auth }).users.getProfile({ userId: "me" });
  const emailAddress = profile.data.emailAddress || "";
  if (!emailAddress || (input.expectedEmailAddress && emailAddress.toLowerCase() !== input.expectedEmailAddress.toLowerCase()))
    throw new Error("The authorized Google Calendar account does not match the expected provider account.");
  const cursor = await getCalendarSyncToken(userId, input.calendarId);
  const watch = await google.calendar({ version: "v3", auth }).events.watch({ calendarId: input.calendarId, requestBody: { id: input.channelId, type: "web_hook", address: input.callbackUrl, token: input.channelToken } });
  if (!watch.data.id || !watch.data.resourceId || !watch.data.expiration) throw new Error("Google Calendar returned an incomplete channel receipt.");
  return { emailAddress, channelId: watch.data.id, resourceId: watch.data.resourceId, cursor, expiresAt: new Date(Number(watch.data.expiration)) };
}

export async function listCalendarChanges(userId: string, calendarId: string, syncToken: string): Promise<{ nextCursor: string; changes: CalendarMetadataChange[]; truncated: boolean }> {
  if (!calendarId.trim() || !syncToken.trim()) throw new Error("Canonical Google Calendar collection and synchronization cursors are required.");
  const auth = await workspaceOAuth(userId);
  const calendar = google.calendar({ version: "v3", auth });
  const changes: CalendarMetadataChange[] = [];
  let pageToken: string | undefined;
  for (let pages = 0; pages < 25; pages += 1) {
    const result = await calendar.events.list({ calendarId, syncToken, pageToken, maxResults: 2500, showDeleted: true, singleEvents: false });
    for (const event of result.data.items || []) {
      if (!event.id) continue;
      const deleted = event.status === "cancelled";
      changes.push({ resourceId: event.id, resourceState: deleted ? "deleted" : "active", providerRevision: event.etag || event.updated || "unknown", title: event.summary || (deleted ? "Cancelled calendar event" : "Untitled calendar event"), providerUrl: event.htmlLink || "", metadata: { status: event.status || null, updated: event.updated || null, start: event.start || null, end: event.end || null, organizerEmail: event.organizer?.email || null, attendeeCount: event.attendees?.length || 0, recurringEventId: event.recurringEventId || null } });
    }
    if (result.data.nextPageToken) { pageToken = result.data.nextPageToken; continue; }
    if (!result.data.nextSyncToken) throw new Error("Google Calendar returned no durable reconciliation cursor.");
    return { nextCursor: result.data.nextSyncToken, changes: changes.slice(0, 500), truncated: changes.length > 500 };
  }
  throw new Error("Google Calendar reconciliation exceeded its bounded page window.");
}

export async function stopGoogleChannel(userId: string, channelId: string, resourceId: string): Promise<void> {
  if (!channelId || !resourceId) return;
  const auth = await workspaceOAuth(userId);
  await google.drive({ version: "v3", auth }).channels.stop({ requestBody: { id: channelId, resourceId } });
}

export async function startMailboxWatch(userId: string, topicName: string, expectedEmailAddress?: string): Promise<{ emailAddress: string; historyId: string; expiresAt: Date }> {
  const token = await storage.getOauthToken(userId, "gmail");
  if (!token || !mailboxWatchScopeCoverage((token.scope || "").split(/\s+/).filter(Boolean)))
    throw new Error("The connected Google authorization does not include a Gmail mailbox-read scope. Reconnect Google Workspace before starting a watch.");
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  if (!profile.data.emailAddress || (expectedEmailAddress && profile.data.emailAddress.toLowerCase() !== expectedEmailAddress.toLowerCase()))
    throw new Error("The authorized Gmail mailbox does not match the expected provider account.");
  const watch = await gmail.users.watch({ userId: "me", requestBody: { topicName } });
  if (!watch.data.historyId || !watch.data.expiration)
    throw new Error("Gmail returned an incomplete mailbox-watch receipt.");
  return { emailAddress: profile.data.emailAddress, historyId: watch.data.historyId, expiresAt: new Date(Number(watch.data.expiration)) };
}

export async function listMailboxHistory(userId: string, startHistoryId: string, maxPages = 10): Promise<{ latestHistoryId: string; changes: Array<{ historyId: string; messageId: string; changeType: string }>; truncated: boolean }> {
  if (!/^\d+$/.test(startHistoryId)) throw new Error("A canonical Gmail history cursor is required.");
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const changes: Array<{ historyId: string; messageId: string; changeType: string }> = [];
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;
  let pages = 0;
  do {
    const result = await gmail.users.history.list({ userId: "me", startHistoryId, maxResults: 100, pageToken, historyTypes: ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"] });
    if (result.data.historyId) latestHistoryId = result.data.historyId;
    for (const item of result.data.history || []) {
      const historyId = item.id || latestHistoryId;
      for (const entry of item.messagesAdded || []) if (entry.message?.id) changes.push({ historyId, messageId: entry.message.id, changeType: "message_added" });
      for (const entry of item.messagesDeleted || []) if (entry.message?.id) changes.push({ historyId, messageId: entry.message.id, changeType: "message_deleted" });
      for (const entry of item.labelsAdded || []) if (entry.message?.id) changes.push({ historyId, messageId: entry.message.id, changeType: "label_added" });
      for (const entry of item.labelsRemoved || []) if (entry.message?.id) changes.push({ historyId, messageId: entry.message.id, changeType: "label_removed" });
      if (changes.length >= 500) return { latestHistoryId, changes: changes.slice(0, 500), truncated: true };
    }
    pageToken = result.data.nextPageToken || undefined;
    pages += 1;
  } while (pageToken && pages < Math.min(25, Math.max(1, maxPages)));
  return { latestHistoryId, changes, truncated: Boolean(pageToken) };
}

export async function stopMailboxWatch(userId: string): Promise<void> {
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  await google.gmail({ version: "v1", auth: oauth2Client }).users.stop({ userId: "me" });
}

export async function verifyPubSubOidcToken(idToken: string, audience: string, expectedServiceAccountEmail: string): Promise<{ email: string; subject: string }> {
  const verifier = new google.auth.OAuth2();
  const ticket = await verifier.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload || payload.email_verified !== true || payload.email !== expectedServiceAccountEmail || !payload.sub)
    throw new Error("Pub/Sub OIDC claims do not match the configured push subscription.");
  return { email: payload.email, subject: payload.sub };
}

export async function isCalendarWriteConnected(userId: string): Promise<boolean> {
  if (!(await isConnected(userId))) return false;
  const token = await storage.getOauthToken(userId, "gmail");
  return Boolean(token && calendarWriteScopeCoverage((token.scope || "").split(/\s+/).filter(Boolean)));
}

export async function createCandidateCalendarEvent(userId: string, input: {
  executionId: string;
  schedulingId: string;
  candidateEmail: string;
  candidateName: string;
  companyName: string;
  opportunityTitle: string;
  schedulingKind: string;
  start: string;
  end: string;
  description: string;
}): Promise<{ eventId: string; htmlLink: string | null; hangoutLink: string | null; status: string | null; start: string; end: string }> {
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const eventId = `eos${createHash("sha256").update(input.executionId).digest("hex").slice(0, 40)}`;
  const requestBody = {
    id: eventId,
    summary: `${input.companyName}: ${input.schedulingKind.replaceAll("_", " ")} — ${input.opportunityTitle}`,
    description: input.description,
    start: { dateTime: input.start },
    end: { dateTime: input.end },
    attendees: [{ email: input.candidateEmail, displayName: input.candidateName }],
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    extendedProperties: { private: { eosSchedulingId: input.schedulingId, eosProviderExecutionId: input.executionId } },
    conferenceData: { createRequest: { requestId: eventId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
  };
  let event;
  try {
    event = await calendar.events.insert({ calendarId: "primary", conferenceDataVersion: 1, sendUpdates: "all", requestBody });
  } catch (error: any) {
    if (Number(error?.code || error?.response?.status) !== 409) throw error;
    event = await calendar.events.get({ calendarId: "primary", eventId });
  }
  return {
    eventId: event.data.id || eventId,
    htmlLink: event.data.htmlLink || null,
    hangoutLink: event.data.hangoutLink || null,
    status: event.data.status || null,
    start: event.data.start?.dateTime || input.start,
    end: event.data.end?.dateTime || input.end,
  };
}

export async function cancelCandidateCalendarEvent(userId: string, eventId: string): Promise<{ eventId: string; status: "cancelled" | "already_absent" }> {
  const accessToken = await getAccessToken(userId);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  try {
    await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: "all" });
    return { eventId, status: "cancelled" };
  } catch (error: any) {
    if (Number(error?.code || error?.response?.status) === 404) return { eventId, status: "already_absent" };
    throw error;
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
      google.calendar({ version: "v3", auth: oauth2Client }).events.list({
        calendarId: "primary",
        maxResults: 1,
        singleEvents: true,
        timeMin: new Date().toISOString(),
      }),
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
