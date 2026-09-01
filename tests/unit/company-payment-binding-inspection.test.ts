import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../scripts/inspect-company-payment-bindings.ts", import.meta.url), "utf8");

describe("company payment binding inspection", () => {
  it("reports tenant and provider state without credential values", () => {
    expect(script).toContain("WHERE b.provider_key = 'stripe'");
    expect(script).toContain('credentialValuesIncluded: false');
    expect(script).toContain('credentialReferencePresent');
    expect(script).not.toContain("EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS");
    expect(script).not.toContain("EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS");
  });
});
