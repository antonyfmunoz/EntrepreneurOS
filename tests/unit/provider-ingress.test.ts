import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseNotionVerification, translateGmailPush, translateGoogleChannel, translateNotionEvent, verifyGoogleChannelToken, verifyNotionSignature } from "../../server/integrations/provider-ingress";
import { providerIngressHealthSnapshot } from "../../server/integrations/provider-ingress-health";
import { providerIngressAlertKey } from "../../server/integrations/provider-ingress-alerts";

describe("provider-native ingress translators", () => {
  it("captures and verifies the exact Notion webhook bytes", () => {
    const token = "secret_verification_token_1234567890";
    const body = Buffer.from(JSON.stringify({ id: "event-1", type: "page.content_updated", timestamp: "2026-08-25T12:00:00.000Z", workspace_id: "workspace-1", subscription_id: "subscription-1", integration_id: "integration-1", entity: { id: "page-1", type: "page" }, data: {}, attempt_number: 1 }));
    const signature = `sha256=${createHmac("sha256", token).update(body).digest("hex")}`;
    expect(parseNotionVerification({ verification_token: token })).toEqual({ verificationToken: token });
    expect(() => verifyNotionSignature(body, signature, token)).not.toThrow();
    expect(() => verifyNotionSignature(Buffer.from(`${body} `), signature, token)).toThrow(/invalid/i);
    expect(translateNotionEvent(JSON.parse(body.toString("utf8")))).toMatchObject({ providerEventId: "event-1", eventType: "page.content_updated", workspaceId: "workspace-1", subscriptionId: "subscription-1" });
  });

  it("translates a Gmail Pub/Sub notification only into a reconciliation signal", () => {
    const data = Buffer.from(JSON.stringify({ emailAddress: "operator@example.test", historyId: "9876543210" })).toString("base64url");
    expect(translateGmailPush({ message: { data, messageId: "pubsub-1", publishTime: "2026-08-25T12:00:00.000Z" }, subscription: "projects/eos/subscriptions/gmail" })).toMatchObject({ providerEventId: "pubsub-1", eventType: "gmail.mailbox.history_changed", historyId: "9876543210", emailAddress: "operator@example.test" });
    expect(() => translateGmailPush({ message: { data: "not-json", messageId: "pubsub-1", publishTime: "2026-08-25T12:00:00.000Z" }, subscription: "projects/eos/subscriptions/gmail" })).toThrow(/base64url JSON/i);
  });

  it("authenticates and translates header-only Google resource signals without retaining the channel token", () => {
    const token = "channel-token-with-sufficient-entropy";
    expect(() => verifyGoogleChannelToken(token, token)).not.toThrow();
    expect(() => verifyGoogleChannelToken("wrong-token", token)).toThrow(/invalid/i);
    const signal = translateGoogleChannel("google_drive", {
      "x-goog-channel-id": "channel-123",
      "x-goog-resource-id": "resource-456",
      "x-goog-resource-state": "exists",
      "x-goog-message-number": "42",
      "x-goog-resource-uri": "https://www.googleapis.com/drive/v3/changes?pageToken=cursor",
      "x-goog-channel-token": token,
    }, new Date("2026-08-25T12:00:00.000Z"));
    expect(signal).toMatchObject({
      providerEventId: "channel-123:42",
      eventType: "google_drive.resource.exists",
      resourceId: "resource-456",
    });
    expect(JSON.stringify(signal.projection)).not.toContain(token);
    expect(() => translateGoogleChannel("google_calendar", {
      "x-goog-channel-id": "channel-123",
      "x-goog-resource-id": "resource-456",
      "x-goog-resource-state": "invented",
      "x-goog-message-number": "42",
      "x-goog-resource-uri": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    })).toThrow();
  });

  it("turns provider receipts into deterministic actionable health without claiming execution", () => {
    const now = new Date("2026-08-25T20:00:00.000Z");
    const health = providerIngressHealthSnapshot({
      now,
      registrations: [
        { id: "gmail-registration", integrationBindingId: "gmail-binding", provider: "gmail", state: "active", watchExpiresAt: new Date("2026-08-25T19:00:00.000Z"), updatedAt: new Date("2026-08-25T18:00:00.000Z") },
        { id: "notion-registration", integrationBindingId: "notion-binding", provider: "notion", state: "pending_verification", watchExpiresAt: null, updatedAt: new Date("2026-08-25T18:00:00.000Z") },
      ],
      events: [{ id: "gmail-event", registrationId: "gmail-registration", processingState: "reconciliation_required", receivedAt: new Date("2026-08-25T17:00:00.000Z") }],
      reconciliationAttempts: [{ id: "reconciliation-attempt", registrationId: "gmail-registration", eventId: "gmail-event", attemptNumber: 5, outcome: "dead_letter", failureCode: "provider_authorization_failed", nextAttemptAt: null, recordedAt: new Date("2026-08-25T19:30:00.000Z") }],
      watchAttempts: [{ id: "watch-attempt", registrationId: "gmail-registration", attemptNumber: 5, outcome: "dead_letter", failureCode: "provider_authorization_failed", nextAttemptAt: null, recordedAt: new Date("2026-08-25T19:45:00.000Z") }],
    });
    expect(health.status).toBe("critical");
    expect(health.counts).toEqual({ critical: 2, material: 0, warning: 1, open: 3 });
    expect(health.alerts.map((item) => item.action)).toEqual(["renew_watch", "replay_reconciliation", "complete_verification"]);
    expect(health.alerts.find((item) => item.kind === "reconciliation_dead_letter")).toMatchObject({ sourceEventId: "gmail-event", sourceAttemptId: "reconciliation-attempt" });
  });

  it("applies registration-specific warning and freshness objectives", () => {
    const registration = { id: "notion-registration", integrationBindingId: "notion-binding", provider: "notion", state: "pending_verification", watchExpiresAt: null, updatedAt: new Date("2026-08-25T19:30:00.000Z") };
    const before = providerIngressHealthSnapshot({ now: new Date("2026-08-25T20:00:00.000Z"), registrations: [registration], events: [], reconciliationAttempts: [], watchAttempts: [], policies: [{ registrationId: registration.id, watchRenewBeforeMinutes: 120, reconciliationOverdueMinutes: 20, pendingVerificationMinutes: 60, externalEscalationEnabled: true, minimumEscalationSeverity: "warning", maxDeliveryAttempts: 3 }] });
    expect(before.alerts).toHaveLength(0);
    const after = providerIngressHealthSnapshot({ now: new Date("2026-08-25T20:31:00.000Z"), registrations: [registration], events: [], reconciliationAttempts: [], watchAttempts: [], policies: [{ registrationId: registration.id, watchRenewBeforeMinutes: 120, reconciliationOverdueMinutes: 20, pendingVerificationMinutes: 60, externalEscalationEnabled: true, minimumEscalationSeverity: "warning", maxDeliveryAttempts: 3 }] });
    expect(after.alerts[0]).toMatchObject({ kind: "verification_required", severity: "warning" });
    expect(providerIngressAlertKey(after.alerts[0])).toMatch(/^[a-f0-9]{64}$/);
    expect(providerIngressAlertKey(after.alerts[0])).toBe(providerIngressAlertKey(after.alerts[0]));
  });

  it("does not relabel an append-only reconciled signal as overdue", () => {
    const registration = { id: "notion-registration", integrationBindingId: "notion-binding", provider: "notion", state: "active", watchExpiresAt: null, updatedAt: new Date("2026-08-25T18:00:00.000Z") };
    const health = providerIngressHealthSnapshot({
      now: new Date("2026-08-26T20:00:00.000Z"),
      registrations: [registration],
      events: [{ id: "notion-event", registrationId: registration.id, processingState: "reconciliation_required", receivedAt: new Date("2026-08-25T18:01:00.000Z") }],
      reconciliationAttempts: [{ id: "notion-attempt", registrationId: registration.id, eventId: "notion-event", attemptNumber: 1, outcome: "succeeded", failureCode: "", nextAttemptAt: null, recordedAt: new Date("2026-08-25T18:02:00.000Z") }],
      watchAttempts: [],
    });
    expect(health.status).toBe("healthy");
    expect(health.alerts).toEqual([]);
  });
});
