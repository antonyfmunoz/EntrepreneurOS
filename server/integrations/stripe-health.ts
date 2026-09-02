import Stripe from "stripe";

type StripeHealthBinding = {
  id: string;
  providerKey: string;
  providerAccountReference: string;
  credentialReference: string | null;
};

export type StripeConnectionHealth = {
  connected: boolean;
  healthy: boolean;
  reason: "ready" | "binding_invalid" | "credential_missing" | "account_mismatch"
    | "provider_unavailable" | "merchant_restricted" | "webhook_secret_missing";
  scope: "merchant_identity_and_credential_configuration";
  // A successful read does not prove a webhook delivery or authorize a charge.
  deliveryVerified: false;
  externalReference: string;
};

function objectMap(value: string | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

/** Read-only merchant identity probe; deliberately usable while effects are off. */
export async function verifyStripeConnection(
  binding: StripeHealthBinding,
): Promise<StripeConnectionHealth> {
  const result = (reason: StripeConnectionHealth["reason"], connected = false): StripeConnectionHealth => ({
    connected,
    healthy: reason === "ready",
    reason,
    scope: "merchant_identity_and_credential_configuration",
    deliveryVerified: false,
    externalReference: reason === "ready"
      ? `provider:stripe:${binding.providerAccountReference}:merchant_identity_verified`
      : `provider:stripe:merchant_identity_check:${reason}`,
  });
  if (binding.providerKey !== "stripe" || !binding.id || !binding.credentialReference
    || !/^acct_[A-Za-z0-9]+$/.test(binding.providerAccountReference))
    return result("binding_invalid");
  const credentials = objectMap(process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS);
  // Never borrow another company's key or fall back to a platform/global key.
  const candidate = Object.hasOwn(credentials, binding.id) ? credentials[binding.id] : null;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return result("credential_missing");
  const credential = candidate as Record<string, unknown>;
  if (credential.provider !== "stripe" || typeof credential.secretKey !== "string"
    || !/^rk_live_[A-Za-z0-9_-]+$/.test(credential.secretKey))
    return result("credential_missing");
  try {
    const client = new Stripe(credential.secretKey, {
      apiVersion: "2026-07-29.dahlia",
      timeout: 20_000,
      maxNetworkRetries: 0,
    });
    const account = await client.accounts.retrieve(null);
    if (account.id !== binding.providerAccountReference) return result("account_mismatch");
    if (!account.charges_enabled || !account.payouts_enabled)
      return result("merchant_restricted", true);
    const webhookMap = objectMap(process.env.EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS);
    const configured = Object.hasOwn(webhookMap, binding.id) ? webhookMap[binding.id] : null;
    const secrets = typeof configured === "string" ? [configured] : Array.isArray(configured) ? configured : [];
    if (!secrets.length || !secrets.every(value => typeof value === "string" && /^whsec_[A-Za-z0-9_-]{16,}$/.test(value)))
      return result("webhook_secret_missing", true);
    return result("ready", true);
  } catch {
    // Provider errors may contain request headers or credential material.
    return result("provider_unavailable");
  }
}
