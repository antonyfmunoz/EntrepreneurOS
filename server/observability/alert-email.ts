import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ALERT_EMAIL_PATH = "/api/operations/alert-email";
const emailPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function alertEmailConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const senderUserId = env.EOS_ALERT_EMAIL_SENDER_USER_ID?.trim() || "";
  const senderAddress = env.EOS_ALERT_EMAIL_SENDER_ADDRESS?.trim().toLowerCase() || "";
  const recipient = env.EOS_ALERT_EMAIL_RECIPIENT?.trim().toLowerCase() || "";
  const secret = env.EOS_ALERT_WEBHOOK_SECRET || "";
  const administrators = (env.EOS_PLATFORM_ADMIN_USER_IDS || "").split(",").map(value => value.trim());
  if (!senderUserId || !administrators.includes(senderUserId) || secret.length < 32
    || !emailPattern.test(senderAddress) || !emailPattern.test(recipient)
    || senderAddress.length > 254 || recipient.length > 254) return null;
  return { senderUserId, senderAddress, recipient, secret };
}

export function verifyAlertEmailRequest(raw: unknown, timestamp: unknown, signature: unknown, secret: string, now = Date.now()) {
  if (!Buffer.isBuffer(raw) || typeof timestamp !== "string" || typeof signature !== "string"
    || raw.byteLength === 0 || raw.byteLength > 16_384 || !/^\d{10}$/.test(timestamp)
    || Math.abs(now - Number(timestamp) * 1000) > 300_000 || !/^sha256=[a-f0-9]{64}$/.test(signature))
    throw new Error("Invalid signed alert.");
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))) throw new Error("Invalid signed alert.");
  const payload = JSON.parse(raw.toString("utf8"));
  if (!payload || payload.standard !== "eos.operational-alert.v1"
    || typeof payload.event !== "string" || !/^[a-z][a-z0-9_]{1,79}$/.test(payload.event)
    || typeof payload.sentAt !== "string" || !Number.isFinite(Date.parse(payload.sentAt))
    || Math.abs(now - Date.parse(payload.sentAt)) > 300_000) throw new Error("Invalid signed alert.");
  // Do not forward caller-controlled subjects, recipients, HTML, error bodies or URLs.
  return {
    id: createHash("sha256").update(raw).digest("hex"),
    event: payload.event as string,
    severity: ["TEST", "SEV-1", "SEV-2", "SEV-3", "SEV-4"].includes(payload.severity) ? String(payload.severity) : "ALERT",
    sentAt: new Date(payload.sentAt).toISOString(),
  };
}

export function renderAlertEmail(alert: ReturnType<typeof verifyAlertEmailRequest>) {
  return {
    subject: `[EOS ${alert.severity}] ${alert.event.replaceAll("_", " ")}`,
    body: `<p>EntrepreneurOS operational alert</p><p>Event: ${alert.event}<br>Severity: ${alert.severity}<br>Time: ${alert.sentAt}</p><p>Receipt: ${alert.id}</p><p>Open EOS Operations to investigate. Sensitive event details stay in EOS; this email is not proof that the issue is resolved.</p>`,
  };
}
