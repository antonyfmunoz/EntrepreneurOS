type ReleaseEnvironment = Record<string, string | undefined>;

function isManagedPostgres(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && Boolean(url.hostname)
      && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isEncryptionKey(value?: string): boolean {
  try { return Buffer.from(value || "", "base64").length === 32; } catch { return false; }
}

function isHttpsOrigin(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && url.origin === value?.replace(/\/$/, "");
  } catch {
    return false;
  }
}

function isHttpsWebhook(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function hasStripePlans(value?: string): boolean {
  try {
    const plans = JSON.parse(value || "{}") as Record<string, { priceId?: string }>;
    return Object.values(plans).some((plan) => plan?.priceId?.startsWith("price_"));
  } catch {
    return false;
  }
}

function isReleaseSubject(value?: string): boolean {
  return Boolean(value && (/^git:[a-f0-9]{40}$/.test(value) || /^image:sha256:[a-f0-9]{64}$/.test(value)));
}

export function runtimeReleaseSubject(env: ReleaseEnvironment = process.env): string | null {
  return isReleaseSubject(env.EOS_RELEASE_SUBJECT) ? env.EOS_RELEASE_SUBJECT! : null;
}

function isEnvironmentSubject(value?: string): boolean {
  return Boolean(value && /^environment:[a-z0-9][a-z0-9-]{2,79}$/.test(value));
}

export function productionRuntimeConfiguration(env: ReleaseEnvironment = process.env) {
  return {
    managedDatabase: isManagedPostgres(env.DATABASE_URL),
    clerkPublishableProduction: Boolean(env.CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_")),
    clerkSecretProduction: Boolean(env.CLERK_SECRET_KEY?.startsWith("sk_live_")),
    sessionSecretStrong: Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32),
    credentialEncryptionConfigured: isEncryptionKey(env.EOS_CREDENTIAL_ENCRYPTION_KEY),
    publicOriginHttps: isHttpsOrigin(env.EOS_PUBLIC_ORIGIN),
    operationalAlertsConfigured: isHttpsWebhook(env.EOS_ALERT_WEBHOOK_URL) && Boolean(env.EOS_ALERT_WEBHOOK_SECRET && env.EOS_ALERT_WEBHOOK_SECRET.length >= 32),
    accountDeletionEnabled: env.EOS_ACCOUNT_DELETION_ENABLED === "true",
    legalEnforcementEnabled: env.EOS_LEGAL_ENFORCEMENT === "true",
    paidSaasEnabled: env.EOS_PUBLIC_PAID_SAAS === "true",
    billingConfigured: Boolean(env.STRIPE_RESTRICTED_KEY?.startsWith("rk_live_") && env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") && hasStripePlans(env.EOS_STRIPE_PLANS)),
    platformAdministratorsConfigured: Boolean(env.EOS_PLATFORM_ADMIN_USER_IDS?.split(",").some((id) => id.trim().length > 0)),
    immutableReleaseSubject: Boolean(runtimeReleaseSubject(env)),
    productionEnvironmentSubject: isEnvironmentSubject(env.EOS_PRODUCTION_ENVIRONMENT_SUBJECT),
  };
}

export function productionRuntimeConfigurationIssues(env: ReleaseEnvironment = process.env): string[] {
  return Object.entries(productionRuntimeConfiguration(env))
    .filter(([, configured]) => !configured)
    .map(([key]) => key);
}
