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
    process.env.STRIPE_WEBHOOK_SECRET = ["whsec", "fixture"].join("_");
    process.env.EOS_STRIPE_PLANS = JSON.stringify({ founder: { priceId: "price_fixture", entitlements: ["portfolio"], seatLimit: 10 } });
    expect(billingConfigured()).toBe(false);
  });

  it("accepts a restricted-key configuration with server-owned price mapping", () => {
    process.env.STRIPE_RESTRICTED_KEY = "rk_test_fixture";
    process.env.STRIPE_WEBHOOK_SECRET = ["whsec", "fixture"].join("_");
    process.env.EOS_STRIPE_PLANS = JSON.stringify({ founder: { priceId: "price_fixture", entitlements: ["portfolio"], seatLimit: 10 } });
    expect(billingConfigured()).toBe(true);
    expect(availableBillingPlans()).toEqual([{ key: "founder" }]);
  });

  it("exposes only valid configured plan keys, never provider price ids", () => {
    process.env.EOS_STRIPE_PLANS = JSON.stringify({
      team: { priceId: "price_team", entitlements: ["portfolio"], seatLimit: 25 },
      broken: { priceId: "product_not_a_price", entitlements: [], seatLimit: 10 },
      missingSeats: { priceId: "price_missing", entitlements: ["portfolio"] },
      founder: { priceId: "price_founder", entitlements: ["portfolio"], seatLimit: 5 },
    });
    expect(availableBillingPlans()).toEqual([{ key: "founder" }, { key: "team" }]);
  });
});
