import { describe, expect, it } from "vitest";
import {
  configuredOperatingCompanyStripeBindings,
  operatingCompanyPaymentsConfigured,
} from "../../server/security/company-payments";

describe("operating-company Stripe configuration", () => {
  const bindingId = "11111111-1111-4111-8111-111111111111";

  it("accepts a live restricted key and matching binding-specific webhook secret", () => {
    const env = {
      EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED: "true",
      EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS: JSON.stringify({
        [bindingId]: { provider: "stripe", secretKey: "rk_live_company_fixture" },
      }),
      EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS: JSON.stringify({
        [bindingId]: ["whsec_company_fixture"],
      }),
    };
    expect(configuredOperatingCompanyStripeBindings(env)).toEqual([bindingId]);
    expect(operatingCompanyPaymentsConfigured(env)).toBe(true);
  });

  it("rejects disabled effects, platform secret keys, test keys, and mismatched bindings", () => {
    expect(operatingCompanyPaymentsConfigured({
      EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED: "false",
      EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS: JSON.stringify({
        [bindingId]: { provider: "stripe", secretKey: "rk_live_company_fixture" },
      }),
      EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS: JSON.stringify({ [bindingId]: "whsec_company_fixture" }),
    })).toBe(false);
    expect(operatingCompanyPaymentsConfigured({
      EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED: "true",
      EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS: JSON.stringify({
        [bindingId]: { provider: "stripe", secretKey: "sk_live_platform_fixture" },
      }),
      EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS: JSON.stringify({
        "22222222-2222-4222-8222-222222222222": "whsec_company_fixture",
      }),
    })).toBe(false);
  });
});
