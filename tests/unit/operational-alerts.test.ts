import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchOperationalAlert, operationalAlertsConfigured, resetOperationalAlertCooldownForTesting } from "../../server/observability/alerts";

describe("operational alert delivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    delete process.env.EOS_ALERT_WEBHOOK_URL;
    delete process.env.EOS_ALERT_WEBHOOK_SECRET;
    resetOperationalAlertCooldownForTesting();
  });

  it("signs alerts and suppresses duplicate event storms within the cooldown", async () => {
    process.env.EOS_ALERT_WEBHOOK_URL = "https://alerts.example.com/entrepreneuros";
    process.env.EOS_ALERT_WEBHOOK_SECRET = "s".repeat(32);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await dispatchOperationalAlert({ event: "account_deletion_worker_failed", severity: "SEV-2" }, 1_800_000)).toBe("sent");
    expect(await dispatchOperationalAlert({ event: "account_deletion_worker_failed", severity: "SEV-2" }, 1_801_000)).toBe("suppressed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-eos-alert-signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(JSON.parse(String(init.body))).toMatchObject({ standard: "eos.operational-alert.v1", event: "account_deletion_worker_failed" });
  });

  it("does nothing when no approved receiver is configured", async () => {
    expect(await dispatchOperationalAlert({ event: "startup_failed" })).toBe("unconfigured");
  });

  it("requires complete fixed-recipient configuration for the native receiver", async () => {
    vi.stubEnv("EOS_ALERT_WEBHOOK_URL", "https://entrepreneuros.net/api/operations/alert-email");
    vi.stubEnv("EOS_ALERT_WEBHOOK_SECRET", "s".repeat(32));
    vi.stubEnv("EOS_ALERT_EMAIL_SENDER_USER_ID", "operator");
    vi.stubEnv("EOS_PLATFORM_ADMIN_USER_IDS", "operator");
    vi.stubEnv("EOS_ALERT_EMAIL_SENDER_ADDRESS", "operator@example.test");
    vi.stubEnv("EOS_ALERT_EMAIL_RECIPIENT", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(operationalAlertsConfigured()).toBe(false);
    expect(await dispatchOperationalAlert({ event: "operational_alert_test" })).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("EOS_ALERT_EMAIL_RECIPIENT", "operator@example.test");
    expect(operationalAlertsConfigured()).toBe(true);
    expect(await dispatchOperationalAlert({ event: "operational_alert_test" })).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
