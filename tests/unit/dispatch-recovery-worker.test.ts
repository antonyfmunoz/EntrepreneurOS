import { describe, expect, it } from "vitest";
import {
  integrationDispatchRecoveryAfterMs,
  integrationDispatchRecoveryIntervalMs,
} from "../../server/integrations/dispatch-recovery-worker";

describe("integration dispatch recovery worker configuration", () => {
  it("uses bounded fail-safe defaults", () => {
    expect(integrationDispatchRecoveryAfterMs({})).toBe(300_000);
    expect(integrationDispatchRecoveryIntervalMs({})).toBe(60_000);
  });

  it("rejects invalid values and clamps unsafe polling windows", () => {
    expect(integrationDispatchRecoveryAfterMs({ EOS_INTEGRATION_DISPATCH_RECOVERY_AFTER_MS: "invalid" })).toBe(300_000);
    expect(integrationDispatchRecoveryAfterMs({ EOS_INTEGRATION_DISPATCH_RECOVERY_AFTER_MS: "1" })).toBe(60_000);
    expect(integrationDispatchRecoveryAfterMs({ EOS_INTEGRATION_DISPATCH_RECOVERY_AFTER_MS: "999999999" })).toBe(86_400_000);
    expect(integrationDispatchRecoveryIntervalMs({ EOS_INTEGRATION_DISPATCH_RECOVERY_INTERVAL_MS: "1" })).toBe(10_000);
  });
});
