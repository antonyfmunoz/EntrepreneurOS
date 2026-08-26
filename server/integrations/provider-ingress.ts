import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const notionVerification = z.object({ verification_token: z.string().trim().min(20).max(500) }).strict();
const notionEvent = z.object({
  id: z.string().trim().min(3).max(500),
  type: z.string().trim().min(3).max(300),
  timestamp: z.string().datetime({ offset: true }),
  workspace_id: z.string().trim().min(3).max(500),
  subscription_id: z.string().trim().min(3).max(500),
  integration_id: z.string().trim().min(3).max(500).optional(),
  entity: z.object({ id: z.string().trim().min(3).max(500), type: z.string().trim().min(1).max(100) }).passthrough(),
  data: z.record(z.unknown()).optional(),
  attempt_number: z.number().int().nonnegative().optional(),
}).passthrough();

const gmailPush = z.object({
  message: z.object({
    data: z.string().min(8).max(100_000),
    messageId: z.string().min(1).max(500),
    publishTime: z.string().datetime({ offset: true }),
  }).passthrough(),
  subscription: z.string().min(3).max(1000),
}).strict();
const gmailSignal = z.object({ emailAddress: z.string().email().max(320), historyId: z.string().regex(/^\d+$/).max(100) }).strict();
const googleChannelSignal = z.object({
  channelId: z.string().trim().min(3).max(500),
  resourceId: z.string().trim().min(3).max(1000),
  resourceState: z.enum(["sync", "exists", "not_exists"]),
  messageNumber: z.string().regex(/^\d+$/).max(100),
  resourceUri: z.string().trim().url().max(2000),
  channelExpiration: z.string().trim().max(300).optional(),
}).strict();

export function sha256(value: Buffer | string): string { return createHash("sha256").update(value).digest("hex"); }

export function parseNotionVerification(value: unknown): { verificationToken: string } | null {
  const parsed = notionVerification.safeParse(value);
  return parsed.success ? { verificationToken: parsed.data.verification_token } : null;
}

export function notionTokenFingerprint(token: string): string { return sha256(token); }

export function verifyNotionSignature(rawBody: Buffer, signature: string | undefined, verificationToken: string): void {
  if (!signature?.startsWith("sha256=")) throw new Error("Notion webhook signature is missing.");
  const expected = Buffer.from(`sha256=${createHmac("sha256", verificationToken).update(rawBody).digest("hex")}`);
  const received = Buffer.from(signature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Notion webhook signature is invalid.");
}

export function translateNotionEvent(value: unknown) {
  const parsed = notionEvent.parse(value);
  return {
    providerEventId: parsed.id,
    eventType: parsed.type,
    providerObjectReference: `${parsed.entity.type}:${parsed.entity.id}`,
    occurredAt: new Date(parsed.timestamp),
    subscriptionId: parsed.subscription_id,
    workspaceId: parsed.workspace_id,
    projection: {
      id: parsed.id, type: parsed.type, timestamp: parsed.timestamp, workspaceId: parsed.workspace_id,
      subscriptionId: parsed.subscription_id, integrationId: parsed.integration_id || null,
      entity: parsed.entity, data: parsed.data || {}, attemptNumber: parsed.attempt_number ?? null,
    },
  };
}

export function translateGmailPush(value: unknown) {
  const envelope = gmailPush.parse(value);
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(envelope.message.data, "base64url").toString("utf8")); }
  catch { throw new Error("Gmail Pub/Sub message data is not valid base64url JSON."); }
  const signal = gmailSignal.parse(decoded);
  return {
    providerEventId: envelope.message.messageId,
    eventType: "gmail.mailbox.history_changed",
    providerObjectReference: `gmail-history:${signal.historyId}`,
    occurredAt: new Date(envelope.message.publishTime),
    subscription: envelope.subscription,
    emailAddress: signal.emailAddress,
    historyId: signal.historyId,
    projection: { messageId: envelope.message.messageId, publishTime: envelope.message.publishTime, subscription: envelope.subscription, emailAddress: signal.emailAddress, historyId: signal.historyId },
  };
}

type GoogleChannelProvider = "google_drive" | "google_calendar";
type HeaderValue = string | string[] | undefined;

function singleHeader(headers: Record<string, HeaderValue>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function verifyGoogleChannelToken(receivedToken: string | undefined, expectedToken: string): void {
  if (!receivedToken) throw new Error("Google channel token is missing.");
  const received = Buffer.from(receivedToken);
  const expected = Buffer.from(expectedToken);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Google channel token is invalid.");
}

export function translateGoogleChannel(
  provider: GoogleChannelProvider,
  headers: Record<string, HeaderValue>,
  occurredAt = new Date(),
) {
  const parsed = googleChannelSignal.parse({
    channelId: singleHeader(headers, "x-goog-channel-id"),
    resourceId: singleHeader(headers, "x-goog-resource-id"),
    resourceState: singleHeader(headers, "x-goog-resource-state"),
    messageNumber: singleHeader(headers, "x-goog-message-number"),
    resourceUri: singleHeader(headers, "x-goog-resource-uri"),
    channelExpiration: singleHeader(headers, "x-goog-channel-expiration"),
  });
  return {
    providerEventId: `${parsed.channelId}:${parsed.messageNumber}`,
    eventType: `${provider}.resource.${parsed.resourceState}`,
    providerObjectReference: `${provider}:${parsed.resourceId}`,
    occurredAt,
    channelId: parsed.channelId,
    resourceId: parsed.resourceId,
    resourceState: parsed.resourceState,
    messageNumber: parsed.messageNumber,
    projection: {
      channelId: parsed.channelId,
      resourceId: parsed.resourceId,
      resourceState: parsed.resourceState,
      messageNumber: parsed.messageNumber,
      resourceUri: parsed.resourceUri,
      channelExpiration: parsed.channelExpiration || null,
    },
  };
}
