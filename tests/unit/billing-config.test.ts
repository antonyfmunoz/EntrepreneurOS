import { afterEach, describe, expect, it } from "vitest";
import { availableBillingPlans, billingConfigured } from "../../server/billing/stripe";

afterEach(() => {
  delete process.env.STRIPE_RESTRICTED_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.EOS_STRIPE_PLANS;
});

describe("billing configuration", () => {
  it("fails closed without a restricted key, signed webhook, and configured plan", () => {
    process.env.STRIPE_RESTRICTED_KEY = "sk_test_not-accepted";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
    process.env.EOS_STRIPE_PLANS = JSON.stringify({ founder: { priceId: "price_fixture", entitlements: ["portfolio"] } });
    expect(billingConfigured()).toBe(false);
  });

  it("accepts a restricted-key configuration with server-owned price mapping", () => {
    process.env.STRIPE_RESTRICTED_KEY = "rk_test_fixture";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
    process.env.EOS_STRIPE_PLANS = JSON.stringify({ founder: { priceId: "price_fixture", entitlements: ["portfolio"] } });
    expect(billingConfigured()).toBe(true);
    expect(availableBillingPlans()).toEqual([{ key: "founder" }]);
  });

  it("exposes only valid configured plan keys, never provider price ids", () => {
    process.env.EOS_STRIPE_PLANS = JSON.stringify({
      team: { priceId: "price_team", entitlements: ["portfolio"] },
      broken: { priceId: "product_not_a_price", entitlements: [] },
      founder: { priceId: "price_founder", entitlements: ["portfolio"] },
    });
    expect(availableBillingPlans()).toEqual([{ key: "founder" }, { key: "team" }]);
  });
});
