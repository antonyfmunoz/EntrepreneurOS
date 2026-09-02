import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyStripeConnection } from "../../server/integrations/stripe-health";

const sdk = vi.hoisted(() => ({ retrieve: vi.fn(), constructed: vi.fn() }));
vi.mock("stripe", () => ({ default: class {
  constructor(...args: unknown[]) { sdk.constructed(...args); }
  accounts = { retrieve: sdk.retrieve };
} }));

const binding = { id: "company-binding", providerKey: "stripe", providerAccountReference: "acct_fixture", credentialReference: "op://EOS/Production/credentials" };
const key = ["rk", "live", "fixture_not_a_real_credential"].join("_");
const signingSecret = "whsec_fixture_not_a_real_secret";

describe("Stripe merchant identity health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED", "false");
    vi.stubEnv("EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS", JSON.stringify({ [binding.id]: { provider: "stripe", secretKey: key } }));
    vi.stubEnv("EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS", JSON.stringify({ [binding.id]: [signingSecret] }));
    sdk.retrieve.mockResolvedValue({ id: binding.providerAccountReference, charges_enabled: true, payouts_enabled: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("verifies the exact merchant without enabling effects or claiming delivery", async () => {
    expect(await verifyStripeConnection(binding)).toMatchObject({ connected: true, healthy: true, reason: "ready", deliveryVerified: false });
    expect(sdk.constructed).toHaveBeenCalledWith(key, { apiVersion: "2026-07-29.dahlia", timeout: 20_000, maxNetworkRetries: 0 });
    expect(sdk.retrieve).toHaveBeenCalledExactlyOnceWith(null);
    expect(process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED).toBe("false");
  });
  it.each(["{}", "[]", "null", "invalid", JSON.stringify({ otherBinding: { provider: "stripe", secretKey: key } })])("fails closed on missing or malformed exact-binding credentials: %s", async value => {
    vi.stubEnv("EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS", value);
    expect(await verifyStripeConnection(binding)).toMatchObject({ healthy: false, connected: false, reason: "credential_missing" });
    expect(sdk.retrieve).not.toHaveBeenCalled();
  });
  it.each(["sk", "test", "wrong-provider"])("rejects credentials outside the approved live restricted-key scope: %s", async variant => {
    vi.stubEnv("EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS", JSON.stringify({ [binding.id]: {
      provider: variant === "wrong-provider" ? "docusign" : "stripe",
      secretKey: variant === "wrong-provider" ? key : variant === "sk" ? ["sk", "live", "fixture"].join("_") : ["rk", "test", "fixture"].join("_"),
    } }));
    expect((await verifyStripeConnection(binding)).reason).toBe("credential_missing");
    expect(sdk.retrieve).not.toHaveBeenCalled();
  });
  it("does not expose the other merchant when a key is mismatched", async () => {
    sdk.retrieve.mockResolvedValue({ id: "acct_wrong_company", charges_enabled: true, payouts_enabled: true });
    const result = await verifyStripeConnection(binding);
    expect(result).toMatchObject({ healthy: false, connected: false, reason: "account_mismatch" });
    expect(JSON.stringify(result)).not.toContain("acct_wrong_company");
  });
  it.each(["charges_enabled", "payouts_enabled"])("reports a restricted merchant as degraded: %s", async field => {
    sdk.retrieve.mockResolvedValue({ id: binding.providerAccountReference, charges_enabled: true, payouts_enabled: true, [field]: false });
    expect(await verifyStripeConnection(binding)).toMatchObject({ healthy: false, connected: true, reason: "merchant_restricted" });
  });
  it.each(["{}", "null", "[]", "bad-json", JSON.stringify({ [binding.id]: [] }), JSON.stringify({ [binding.id]: ["invalid"] }), JSON.stringify({ otherBinding: [signingSecret] })])("requires exact-binding webhook configuration: %s", async value => {
    vi.stubEnv("EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS", value);
    expect(await verifyStripeConnection(binding)).toMatchObject({ healthy: false, connected: true, reason: "webhook_secret_missing" });
  });
  it("accepts the supported single-string webhook configuration", async () => {
    vi.stubEnv("EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS", JSON.stringify({ [binding.id]: signingSecret }));
    expect((await verifyStripeConnection(binding)).healthy).toBe(true);
  });
  it("redacts credential-bearing provider failures", async () => {
    sdk.retrieve.mockRejectedValue(new Error(`Authorization Bearer ${key}; ${signingSecret}`));
    const result = await verifyStripeConnection(binding);
    expect(result.reason).toBe("provider_unavailable");
    expect(JSON.stringify(result)).not.toContain(key);
    expect(JSON.stringify(result)).not.toContain(signingSecret);
  });
  it.each([{ providerKey: "docusign" }, { providerAccountReference: "" }, { credentialReference: null }, { id: "" }])("rejects incomplete or wrong-provider bindings", async overrides => {
    expect((await verifyStripeConnection({ ...binding, ...overrides })).reason).toBe("binding_invalid");
    expect(sdk.retrieve).not.toHaveBeenCalled();
  });
});
