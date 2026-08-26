import { describe, expect, it } from "vitest";
import { integrationAdapterEventSchema } from "../../shared/integration-operations";
import {
  adapterWebhookSecretFingerprint,
  generateAdapterWebhookSecret,
  signAdapterWebhook,
  verifyAdapterWebhook,
} from "../../server/integrations/adapter-webhook";

describe("signed adapter webhook contract", () => {
  const body = Buffer.from(JSON.stringify({ schemaVersion: "eos.adapter-event.v1", eventId: "provider-event-1" }));
  const nowMs = Date.parse("2026-08-25T12:00:00.000Z");
  const timestamp = Math.floor(nowMs / 1000);

  it("generates opaque secrets, stable fingerprints, and verifies the current key", () => {
    const secret = generateAdapterWebhookSecret();
    expect(secret).toMatch(/^eoswhsec_[A-Za-z0-9_-]{43}$/);
    expect(adapterWebhookSecretFingerprint(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyAdapterWebhook({ rawBody: body, timestampHeader: String(timestamp), signatureHeader: signAdapterWebhook(secret, timestamp, body), secrets: [{ secret, keyVersion: "current" }], nowMs })).toBe("current");
  });

  it("accepts a rotation grace key but rejects tampering and replay-window violations", () => {
    const current = generateAdapterWebhookSecret(); const previous = generateAdapterWebhookSecret();
    expect(verifyAdapterWebhook({ rawBody: body, timestampHeader: String(timestamp), signatureHeader: signAdapterWebhook(previous, timestamp, body), secrets: [{ secret: current, keyVersion: "current" }, { secret: previous, keyVersion: "previous" }], nowMs })).toBe("previous");
    expect(() => verifyAdapterWebhook({ rawBody: Buffer.from(`${body.toString("utf8")} `), timestampHeader: String(timestamp), signatureHeader: signAdapterWebhook(previous, timestamp, body), secrets: [{ secret: previous, keyVersion: "previous" }], nowMs })).toThrow(/invalid/i);
    expect(() => verifyAdapterWebhook({ rawBody: body, timestampHeader: String(timestamp - 301), signatureHeader: signAdapterWebhook(current, timestamp - 301, body), secrets: [{ secret: current, keyVersion: "current" }], nowMs })).toThrow(/replay window/i);
  });

  it("enforces a strict, bounded event envelope", () => {
    const valid = { schemaVersion: "eos.adapter-event.v1", eventId: "provider-event-1", eventType: "provider.execution.completed", occurredAt: "2026-08-25T12:00:00.000Z", outcome: "succeeded", externalReference: "provider:receipt:1", summary: "Provider recorded the exact operation as complete.", data: { status: "complete" } };
    expect(integrationAdapterEventSchema.parse(valid).outcome).toBe("succeeded");
    expect(() => integrationAdapterEventSchema.parse({ ...valid, unexpected: true })).toThrow();
    expect(() => integrationAdapterEventSchema.parse({ ...valid, data: { oversized: "x".repeat(64_001) } })).toThrow(/bounded projection/i);
    expect(() => integrationAdapterEventSchema.parse({ ...valid, data: { authorization: `Bearer ${"x".repeat(32)}` } })).toThrow(/secret material/i);
  });
});
