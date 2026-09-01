type CompanyPaymentEnvironment = Record<string, string | undefined>;

type StripeExecutionCredential = {
  provider?: string;
  secretKey?: string;
};

function parseObject(value?: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function webhookSecrets(value: unknown): string[] {
  const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return values.filter(
    (secret): secret is string =>
      typeof secret === "string" && secret.startsWith("whsec_") && secret.length > 16,
  );
}

export function configuredOperatingCompanyStripeBindings(
  env: CompanyPaymentEnvironment = process.env,
): string[] {
  if (env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED !== "true") return [];
  const credentials = parseObject(env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS);
  const webhooks = parseObject(env.EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS);
  return Object.entries(credentials)
    .filter(([bindingId, value]) => {
      const credential = value as StripeExecutionCredential | null;
      return Boolean(
        bindingId.trim() &&
        credential?.provider === "stripe" &&
        credential.secretKey?.startsWith("rk_live_") &&
        webhookSecrets(webhooks[bindingId]).length,
      );
    })
    .map(([bindingId]) => bindingId)
    .sort();
}

export function operatingCompanyPaymentsConfigured(
  env: CompanyPaymentEnvironment = process.env,
): boolean {
  return configuredOperatingCompanyStripeBindings(env).length > 0;
}
