import { operatingCompanyPaymentsConfigured } from "./company-payments";
import { nativeClamavConfigured } from "./malware-scanner";
import { ALERT_EMAIL_PATH, alertEmailConfiguration } from "../observability/alert-email";

type ReleaseEnvironment = Record<string, string | undefined>;

function isManagedPostgres(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      Boolean(url.hostname) &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function isEncryptionKey(value?: string): boolean {
  try {
    return Buffer.from(value || "", "base64").length === 32;
  } catch {
    return false;
  }
}

function isHttpsOrigin(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return (
      url.protocol === "https:" && url.origin === value?.replace(/\/$/, "")
    );
  } catch {
    return false;
  }
}

function isHttpsWebhook(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export type UntrustedArtifactIngressMode =
  | "trusted_source"
  | "scanner_backed"
  | "unsafe";

export function malwareScannerConfigured(
  env: ReleaseEnvironment = process.env,
): boolean {
  return (
    nativeClamavConfigured(env as NodeJS.ProcessEnv) ||
    (isHttpsWebhook(env.EOS_MALWARE_SCAN_ENDPOINT) &&
      Boolean(
        env.EOS_MALWARE_SCAN_SECRET &&
          env.EOS_MALWARE_SCAN_SECRET.length >= 32,
      ))
  );
}

export function untrustedArtifactIngressMode(
  env: ReleaseEnvironment = process.env,
): UntrustedArtifactIngressMode {
  if (env.EOS_UNTRUSTED_UPLOADS_ENABLED === "false") return "trusted_source";
  if (
    env.EOS_UNTRUSTED_UPLOADS_ENABLED === "true" &&
    (malwareScannerConfigured(env) ||
      (env.NODE_ENV === "test" && env.EOS_MALWARE_SCAN_MODE === "test-fixture"))
  )
    return "scanner_backed";
  return "unsafe";
}

export function untrustedArtifactUploadsEnabled(
  env: ReleaseEnvironment = process.env,
): boolean {
  return untrustedArtifactIngressMode(env) === "scanner_backed";
}

function hasStripePlans(value?: string): boolean {
  try {
    const plans = JSON.parse(value || "{}") as Record<
      string,
      { priceId?: string; entitlements?: unknown; seatLimit?: number }
    >;
    return Object.values(plans).some(
      (plan) =>
        plan?.priceId?.startsWith("price_") &&
        Array.isArray(plan.entitlements) &&
        Number.isInteger(plan.seatLimit) &&
        plan.seatLimit! >= 1 &&
        plan.seatLimit! <= 10_000,
    );
  } catch {
    return false;
  }
}

function recoveryProviderExecutionSafe(env: ReleaseEnvironment): boolean {
  if (env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED !== "true") return true;
  try {
    const credentials = JSON.parse(
      env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS || "{}",
    ) as Record<string, { provider?: string }>;
    const entries = Object.entries(credentials);
    return (
      entries.length > 0 &&
      entries.every(
        ([key, value]) =>
          key.trim().length > 0 &&
          ["stripe", "docusign"].includes(value?.provider || ""),
      ) &&
      Boolean(env.EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS?.trim()) &&
      isHttpsOrigin(env.EOS_PUBLIC_ORIGIN)
    );
  } catch {
    return false;
  }
}

function integrationProviderExecutionSafe(env: ReleaseEnvironment): boolean {
  if (env.EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED !== "true") return true;
  return Boolean(
    isEncryptionKey(env.EOS_CREDENTIAL_ENCRYPTION_KEY) &&
    isHttpsOrigin(env.EOS_PUBLIC_ORIGIN) &&
    env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim() && isHttpsWebhook(env.GOOGLE_REDIRECT_URI) &&
    env.NOTION_CLIENT_ID?.trim() && env.NOTION_CLIENT_SECRET?.trim() && isHttpsWebhook(env.NOTION_REDIRECT_URI),
  );
}

function isReleaseSubject(value?: string): boolean {
  return Boolean(
    value &&
    (/^git:[a-f0-9]{40}$/.test(value) ||
      /^image:sha256:[a-f0-9]{64}$/.test(value)),
  );
}

export function runtimeReleaseSubject(
  env: ReleaseEnvironment = process.env,
): string | null {
  return isReleaseSubject(env.EOS_RELEASE_SUBJECT)
    ? env.EOS_RELEASE_SUBJECT!
    : null;
}

function isEnvironmentSubject(value?: string): boolean {
  return Boolean(value && /^environment:[a-z0-9][a-z0-9-]{2,79}$/.test(value));
}

function isVendorName(value?: string): boolean {
  return Boolean(
    value?.trim() &&
    /^[A-Za-z0-9][A-Za-z0-9 .,&()'/-]{1,79}$/.test(value.trim()),
  );
}

function isS3ArtifactPlane(env: ReleaseEnvironment, backup = false): boolean {
  const prefix = backup ? "EOS_ARTIFACT_BACKUP_" : "EOS_ARTIFACT_";
  return env[`${prefix}STORAGE_PROVIDER`] === "s3"
    && Boolean(env[`${prefix}S3_BUCKET`]?.trim())
    && Boolean(env[`${prefix}S3_REGION`]?.trim());
}

function hasS3ArtifactCredentials(env: ReleaseEnvironment, backup = false): boolean {
  const prefix = backup ? "EOS_ARTIFACT_BACKUP_" : "EOS_ARTIFACT_";
  return Boolean(
    env[`${prefix}S3_ACCESS_KEY_ID`]?.trim()
    && env[`${prefix}S3_SECRET_ACCESS_KEY`]?.trim(),
  );
}

function hasS3ArtifactEncryption(env: ReleaseEnvironment, backup = false): boolean {
  const prefix = backup ? "EOS_ARTIFACT_BACKUP_" : "EOS_ARTIFACT_";
  if (env[`${prefix}S3_KMS_KEY_ID`]?.trim()) return true;
  try {
    const value = env[`${prefix}S3_SSE_CUSTOMER_KEY`]?.trim() || "";
    const decoded = Buffer.from(value, "base64");
    return decoded.length === 32 && decoded.toString("base64") === value;
  } catch {
    return false;
  }
}

export function declaredInfrastructureVendors(
  env: ReleaseEnvironment = process.env,
): string[] {
  return Array.from(
    new Set(
      [
        "Fly.io",
        "GitHub",
        env.EOS_DATABASE_VENDOR_NAME?.trim(),
        env.EOS_DNS_VENDOR_NAME?.trim(),
        env.EOS_SECRET_VAULT_VENDOR_NAME?.trim(),
      ].filter((name): name is string => isVendorName(name)),
    ),
  );
}

export function productionRuntimeConfiguration(
  env: ReleaseEnvironment = process.env,
) {
  const paidSaas = env.EOS_PUBLIC_PAID_SAAS === "true";
  const paidSaasDeclared = paidSaas || env.EOS_PUBLIC_PAID_SAAS === "false";
  const platformBillingFieldsPresent = Boolean(
    env.STRIPE_RESTRICTED_KEY?.trim() ||
    env.STRIPE_WEBHOOK_SECRET?.trim() ||
    env.EOS_STRIPE_PLANS?.trim(),
  );
  return {
    managedDatabase: isManagedPostgres(env.DATABASE_URL),
    clerkPublishableProduction: Boolean(
      env.CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_"),
    ),
    clerkSecretProduction: Boolean(
      env.CLERK_SECRET_KEY?.startsWith("sk_live_"),
    ),
    sessionSecretStrong: Boolean(
      env.SESSION_SECRET && env.SESSION_SECRET.length >= 32,
    ),
    credentialEncryptionConfigured: isEncryptionKey(
      env.EOS_CREDENTIAL_ENCRYPTION_KEY,
    ),
    googleOAuthConfigured: Boolean(
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      isHttpsWebhook(env.GOOGLE_REDIRECT_URI),
    ),
    notionOAuthConfigured: Boolean(
      env.NOTION_CLIENT_ID &&
      env.NOTION_CLIENT_SECRET &&
      isHttpsWebhook(env.NOTION_REDIRECT_URI),
    ),
    publicOriginHttps: isHttpsOrigin(env.EOS_PUBLIC_ORIGIN),
    operationalAlertsConfigured:
      isHttpsWebhook(env.EOS_ALERT_WEBHOOK_URL) &&
      Boolean(
        env.EOS_ALERT_WEBHOOK_SECRET &&
        env.EOS_ALERT_WEBHOOK_SECRET.length >= 32,
      ) && (
        !env.EOS_ALERT_WEBHOOK_URL?.endsWith(ALERT_EMAIL_PATH) || Boolean(alertEmailConfiguration(env))
      ),
    accountDeletionEnabled: env.EOS_ACCOUNT_DELETION_ENABLED === "true",
    legalEnforcementEnabled: env.EOS_LEGAL_ENFORCEMENT === "true",
    commercialModeDeclared: paidSaasDeclared,
    platformBillingSafe: paidSaas
      ? Boolean(
          env.STRIPE_RESTRICTED_KEY?.startsWith("rk_live_") &&
          env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") &&
          hasStripePlans(env.EOS_STRIPE_PLANS),
        )
      : !platformBillingFieldsPresent,
    operatingCompanyPaymentsConfigured: paidSaas
      ? true
      : operatingCompanyPaymentsConfigured(env),
    anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY?.trim()),
    productAnalyticsConfigured: Boolean(
      env.POSTHOG_API_KEY?.startsWith("phc_") &&
      !env.POSTHOG_API_KEY.toLowerCase().includes("placeholder"),
    ),
    platformAdministratorsConfigured: Boolean(
      env.EOS_PLATFORM_ADMIN_USER_IDS?.split(",").some(
        (id) => id.trim().length > 0,
      ),
    ),
    infrastructureVendorsDeclared: [
      env.EOS_DATABASE_VENDOR_NAME,
      env.EOS_DNS_VENDOR_NAME,
      env.EOS_SECRET_VAULT_VENDOR_NAME,
    ].every(isVendorName),
    immutableReleaseSubject: Boolean(runtimeReleaseSubject(env)),
    productionEnvironmentSubject: isEnvironmentSubject(
      env.EOS_PRODUCTION_ENVIRONMENT_SUBJECT,
    ),
    artifactStorageConfigured: Boolean(env.EOS_ARTIFACT_STORAGE_ROOT?.trim()) || isS3ArtifactPlane(env),
    nativeEsignSharedStorageConfigured: isS3ArtifactPlane(env),
    nativeEsignPrimaryCredentialsConfigured: hasS3ArtifactCredentials(env),
    nativeEsignPrimaryEncryptionConfigured: hasS3ArtifactEncryption(env),
    nativeEsignBackupStorageConfigured: isS3ArtifactPlane(env, true)
      && env.EOS_ARTIFACT_BACKUP_S3_BUCKET !== env.EOS_ARTIFACT_S3_BUCKET,
    nativeEsignBackupCredentialsConfigured: hasS3ArtifactCredentials(env, true),
    nativeEsignBackupEncryptionConfigured: hasS3ArtifactEncryption(env, true),
    untrustedArtifactIngressSafe:
      untrustedArtifactIngressMode(env) !== "unsafe",
    candidateTranscriptionSafe:
      env.EOS_CANDIDATE_STT_ENABLED !== "true" ||
      Boolean(
        env.OPENAI_API_KEY?.trim() &&
        env.EOS_CANDIDATE_STT_MODEL?.trim()?.match(
          /^[A-Za-z0-9][A-Za-z0-9._:-]{1,99}$/,
        ),
      ),
    recoveryProviderExecutionSafe: recoveryProviderExecutionSafe(env),
    integrationProviderExecutionSafe: integrationProviderExecutionSafe(env),
  };
}

export function productionRuntimeConfigurationIssues(
  env: ReleaseEnvironment = process.env,
): string[] {
  return Object.entries(productionRuntimeConfiguration(env))
    .filter(([, configured]) => !configured)
    .map(([key]) => key);
}

/** Deployment safety is not payment-launch readiness. All other gates are shared. */
export function productionDeploymentConfiguration(
  env: ReleaseEnvironment = process.env,
) {
  const { operatingCompanyPaymentsConfigured: paymentsConfigured, ...safety } = productionRuntimeConfiguration(env);
  return {
    ...safety,
    operatingCompanyPaymentBoundarySafe: paymentsConfigured || (
      env.EOS_PUBLIC_PAID_SAAS === "false" && env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED === "false"
    ),
  };
}

export function productionDeploymentConfigurationIssues(
  env: ReleaseEnvironment = process.env,
): string[] {
  return Object.entries(productionDeploymentConfiguration(env))
    .filter(([, configured]) => !configured)
    .map(([key]) => key);
}
