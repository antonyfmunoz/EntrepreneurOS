import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchOperationalAlert, resetOperationalAlertCooldownForTesting } from "../../server/observability/alerts";

describe("operational alert delivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
