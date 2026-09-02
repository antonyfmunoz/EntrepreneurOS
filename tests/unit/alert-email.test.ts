import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { alertEmailConfiguration, renderAlertEmail, verifyAlertEmailRequest } from "../../server/observability/alert-email";

const now = Date.now();
const secret = "synthetic-alert-secret-for-unit-tests-only";
const timestamp = String(Math.floor(now / 1000));
const body = Buffer.from(JSON.stringify({ standard: "eos.operational-alert.v1", event: "operational_alert_test", severity: "TEST", sentAt: new Date(now).toISOString(), to: "wrong@example.test", subject: "injected", error: "private detail", html: "<script>bad</script>" }));
const sign = (raw = body, time = timestamp) => "sha256=" + createHmac("sha256", secret).update(time + ".").update(raw).digest("hex");
const env = { EOS_PLATFORM_ADMIN_USER_IDS: "operator", EOS_ALERT_EMAIL_SENDER_USER_ID: "operator", EOS_ALERT_EMAIL_SENDER_ADDRESS: "sender@example.test", EOS_ALERT_EMAIL_RECIPIENT: "recipient@example.test", EOS_ALERT_WEBHOOK_SECRET: secret };

describe("signed fixed-recipient operational alerts", () => {
  it("verifies and renders only the minimal safe alert fields", () => {
    const alert = verifyAlertEmailRequest(body, timestamp, sign(), secret, now);
    expect(alert.id).toMatch(/^[a-f0-9]{64}$/);
    const rendered = JSON.stringify(renderAlertEmail(alert));
    for (const unsafe of ["wrong@example.test", "injected", "private detail", "<script>"])
      expect(rendered).not.toContain(unsafe);
    expect(rendered).toContain("operational alert test");
  });
  it.each(["", "sha256=bad", "sha256=" + "0".repeat(64)])("rejects invalid signatures", signature => {
    expect(() => verifyAlertEmailRequest(body, timestamp, signature, secret, now)).toThrow();
  });
  it("rejects tampering, future and stale deliveries", () => {
    expect(() => verifyAlertEmailRequest(Buffer.from(body.toString().replace("TEST", "SEV-1")), timestamp, sign(), secret, now)).toThrow();
    for (const delta of [-301_000, 301_000])
      expect(() => verifyAlertEmailRequest(body, timestamp, sign(), secret, now + delta)).toThrow();
  });
  it("requires payload freshness even when the header is freshly signed", () => {
    const stale = Buffer.from(JSON.stringify({ standard: "eos.operational-alert.v1", event: "alert_test", sentAt: new Date(now - 600_000).toISOString() }));
    expect(() => verifyAlertEmailRequest(stale, timestamp, sign(stale), secret, now)).toThrow();
  });
  it.each(["null", "[]", "bad json", JSON.stringify({ standard: "eos.operational-alert.v1", event: "<script>", sentAt: new Date(now).toISOString() })])("rejects malformed signed payloads", value => {
    const raw = Buffer.from(value);
    expect(() => verifyAlertEmailRequest(raw, timestamp, sign(raw), secret, now)).toThrow();
  });
  it("bounds payload size", () => {
    const raw = Buffer.alloc(16_385, 65);
    expect(() => verifyAlertEmailRequest(raw, timestamp, sign(raw), secret, now)).toThrow();
  });
  it("requires a configured platform-admin sender and one fixed recipient", () => {
    expect(alertEmailConfiguration(env)?.recipient).toBe("recipient@example.test");
    for (const change of [{ EOS_ALERT_EMAIL_SENDER_USER_ID: "other" }, { EOS_ALERT_EMAIL_RECIPIENT: "a@example.test,b@example.test" }, { EOS_ALERT_EMAIL_RECIPIENT: "a@example.test\r\nBcc:x@example.test" }, { EOS_ALERT_EMAIL_SENDER_ADDRESS: "" }, { EOS_ALERT_WEBHOOK_SECRET: "short" }])
      expect(alertEmailConfiguration({ ...env, ...change })).toBeNull();
  });
});
