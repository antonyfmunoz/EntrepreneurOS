import { createHmac } from "node:crypto";
import { ALERT_EMAIL_PATH, alertEmailConfiguration } from "./alert-email";

type AlertPayload = Record<string, unknown> & { event: string; deduplicationKey?: string };
const lastSentAt = new Map<string, number>();

export function operationalAlertsConfigured(): boolean {
  try {
    const url = new URL(process.env.EOS_ALERT_WEBHOOK_URL || "");
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && Boolean(process.env.EOS_ALERT_WEBHOOK_SECRET && process.env.EOS_ALERT_WEBHOOK_SECRET.length >= 32)
      && (url.pathname !== ALERT_EMAIL_PATH || Boolean(alertEmailConfiguration()));
  } catch {
    return false;
  }
}

export async function dispatchOperationalAlert(payload: AlertPayload, now = Date.now()): Promise<"sent" | "suppressed" | "unconfigured"> {
  if (!operationalAlertsConfigured()) return "unconfigured";
  const cooldownMs = Math.max(10_000, Math.min(3_600_000, Number(process.env.EOS_ALERT_COOLDOWN_MS || 300_000)));
  const deduplicationKey = payload.deduplicationKey || payload.event;
  const previous = lastSentAt.get(deduplicationKey) || 0;
  if (now - previous < cooldownMs) return "suppressed";
  lastSentAt.set(deduplicationKey, now);
  const body = JSON.stringify({ standard: "eos.operational-alert.v1", sentAt: new Date(now).toISOString(), ...payload });
  const timestamp = String(Math.floor(now / 1000));
  const signature = createHmac("sha256", process.env.EOS_ALERT_WEBHOOK_SECRET!).update(`${timestamp}.${body}`).digest("hex");
  const controller = new AbortController();
  const nativeEmail = new URL(process.env.EOS_ALERT_WEBHOOK_URL!).pathname === ALERT_EMAIL_PATH;
  const timeout = setTimeout(() => controller.abort(), nativeEmail ? 35_000 : 5_000);
  try {
    const response = await fetch(process.env.EOS_ALERT_WEBHOOK_URL!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "EntrepreneurOS-Operations/1.0",
        "x-eos-alert-timestamp": timestamp,
        "x-eos-alert-signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Operational alert receiver returned ${response.status}.`);
    return "sent";
  } catch (error) {
    lastSentAt.delete(deduplicationKey);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function resetOperationalAlertCooldownForTesting(): void {
  lastSentAt.clear();
}
