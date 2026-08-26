import { describe, expect, it } from "vitest";
import { declaredInfrastructureVendors, productionRuntimeConfigurationIssues, runtimeReleaseSubject } from "../../server/security/release-configuration";

const valid = {
  DATABASE_URL: "postgresql://app:secret@db.example.com/eos?sslmode=require",
  CLERK_PUBLISHABLE_KEY: "pk_live_example",
  CLERK_SECRET_KEY: ["sk", "live", "example"].join("_"),
  SESSION_SECRET: "s".repeat(32),
  EOS_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GOOGLE_REDIRECT_URI: "https://entrepreneuros.net/api/auth/google/callback",
  NOTION_CLIENT_ID: "notion-client",
  NOTION_CLIENT_SECRET: "notion-secret",
  NOTION_REDIRECT_URI: "https://entrepreneuros.net/api/auth/notion/callback",
  EOS_PUBLIC_ORIGIN: "https://entrepreneuros.net",
  EOS_ALERT_WEBHOOK_URL: "https://alerts.example.com/entrepreneuros",
  EOS_ALERT_WEBHOOK_SECRET: "a".repeat(32),
  EOS_ACCOUNT_DELETION_ENABLED: "true",
  EOS_LEGAL_ENFORCEMENT: "true",
  EOS_PUBLIC_PAID_SAAS: "true",
  STRIPE_RESTRICTED_KEY: ["rk", "live", "example"].join("_"),
  STRIPE_WEBHOOK_SECRET: ["whsec", "example"].join("_"),
  EOS_STRIPE_PLANS: JSON.stringify({ founder: { priceId: "price_example", entitlements: ["portfolio:create", "company:create"], seatLimit: 10 } }),
  EOS_PLATFORM_ADMIN_USER_IDS: "user_production_admin",
  ANTHROPIC_API_KEY: "anthropic-production-key",
  POSTHOG_API_KEY: "phc_entrepreneuros_production",
  EOS_DATABASE_VENDOR_NAME: "Neon",
  EOS_DNS_VENDOR_NAME: "Cloudflare",
  EOS_SECRET_VAULT_VENDOR_NAME: "1Password",
  EOS_RELEASE_SUBJECT: `git:${"a".repeat(40)}`,
  EOS_PRODUCTION_ENVIRONMENT_SUBJECT: "environment:entrepreneuros-production",
  EOS_ARTIFACT_STORAGE_ROOT: "/var/lib/entrepreneuros/artifacts",
  EOS_ARTIFACT_STORAGE_PROVIDER: "s3",
  EOS_ARTIFACT_S3_BUCKET: "eos-primary",
  EOS_ARTIFACT_S3_REGION: "us-west-2",
  EOS_ARTIFACT_S3_KMS_KEY_ID: "arn:aws:kms:us-west-2:123456789012:key/primary",
  EOS_ARTIFACT_BACKUP_STORAGE_PROVIDER: "s3",
  EOS_ARTIFACT_BACKUP_S3_BUCKET: "eos-backup",
  EOS_ARTIFACT_BACKUP_S3_REGION: "us-east-1",
  EOS_ARTIFACT_BACKUP_S3_KMS_KEY_ID: "arn:aws:kms:us-east-1:123456789012:key/backup",
  EOS_MALWARE_SCAN_ENDPOINT: "https://scanner.example.com/scan",
  EOS_MALWARE_SCAN_SECRET: "m".repeat(32),
};

describe("production runtime configuration", () => {
  it("accepts a complete production identity and managed runtime", () => {
    expect(productionRuntimeConfigurationIssues(valid)).toEqual([]);
    expect(runtimeReleaseSubject(valid)).toBe(valid.EOS_RELEASE_SUBJECT);
    expect(declaredInfrastructureVendors(valid)).toEqual(["Fly.io", "GitHub", "Neon", "Cloudflare", "1Password"]);
  });

  it("rejects development identity, local storage, weak secrets, and insecure origins", () => {
    expect(productionRuntimeConfigurationIssues({
      ...valid,
      DATABASE_URL: "postgresql://localhost/eos",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
      SESSION_SECRET: "short",
      EOS_CREDENTIAL_ENCRYPTION_KEY: "invalid",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      GOOGLE_REDIRECT_URI: "http://localhost/google",
      NOTION_CLIENT_ID: "",
      NOTION_CLIENT_SECRET: "",
      NOTION_REDIRECT_URI: "http://localhost/notion",
      EOS_PUBLIC_ORIGIN: "http://localhost:5000",
      EOS_ALERT_WEBHOOK_URL: "https://user:secret@alerts.example.com/hook?token=secret",
      EOS_ALERT_WEBHOOK_SECRET: "short",
      EOS_ACCOUNT_DELETION_ENABLED: "false",
      EOS_LEGAL_ENFORCEMENT: "false",
      EOS_PUBLIC_PAID_SAAS: "false",
      STRIPE_RESTRICTED_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "bad",
      EOS_STRIPE_PLANS: "{}",
      EOS_PLATFORM_ADMIN_USER_IDS: "",
      ANTHROPIC_API_KEY: "",
      POSTHOG_API_KEY: "placeholder",
      EOS_DATABASE_VENDOR_NAME: "",
      EOS_DNS_VENDOR_NAME: "?",
      EOS_SECRET_VAULT_VENDOR_NAME: "",
      EOS_RELEASE_SUBJECT: "latest",
      EOS_PRODUCTION_ENVIRONMENT_SUBJECT: "production",
      EOS_ARTIFACT_STORAGE_ROOT: "",
      EOS_ARTIFACT_STORAGE_PROVIDER: "filesystem",
      EOS_ARTIFACT_S3_BUCKET: "",
      EOS_ARTIFACT_S3_REGION: "",
      EOS_ARTIFACT_S3_KMS_KEY_ID: "",
      EOS_ARTIFACT_BACKUP_STORAGE_PROVIDER: "filesystem",
      EOS_ARTIFACT_BACKUP_S3_BUCKET: "",
      EOS_ARTIFACT_BACKUP_S3_REGION: "",
      EOS_ARTIFACT_BACKUP_S3_KMS_KEY_ID: "",
      EOS_MALWARE_SCAN_ENDPOINT: "http://scanner.example.com/scan?secret=bad",
      EOS_MALWARE_SCAN_SECRET: "short",
      EOS_CANDIDATE_STT_ENABLED: "true",
      EOS_CANDIDATE_STT_MODEL: "",
      OPENAI_API_KEY: "",
    })).toEqual([
      "managedDatabase",
      "clerkPublishableProduction",
      "clerkSecretProduction",
      "sessionSecretStrong",
      "credentialEncryptionConfigured",
      "googleOAuthConfigured",
      "notionOAuthConfigured",
      "publicOriginHttps",
      "operationalAlertsConfigured",
      "accountDeletionEnabled",
      "legalEnforcementEnabled",
      "paidSaasEnabled",
      "billingConfigured",
      "anthropicConfigured",
      "productAnalyticsConfigured",
      "platformAdministratorsConfigured",
      "infrastructureVendorsDeclared",
      "immutableReleaseSubject",
      "productionEnvironmentSubject",
      "artifactStorageConfigured",
      "nativeEsignSharedStorageConfigured",
      "nativeEsignPrimaryKmsConfigured",
      "nativeEsignBackupStorageConfigured",
      "nativeEsignBackupKmsConfigured",
      "malwareScannerConfigured",
      "candidateTranscriptionSafe",
    ]);
    expect(runtimeReleaseSubject({ EOS_RELEASE_SUBJECT: "latest" })).toBeNull();
  });

  it("fails closed when Recovery effects are enabled without exact managed execution bindings", () => {
    expect(productionRuntimeConfigurationIssues({
      ...valid,
      EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED: "true",
      EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS: "{}",
      EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS: "{}",
    })).toContain("recoveryProviderExecutionSafe");
    expect(productionRuntimeConfigurationIssues({
      ...valid,
      EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED: "true",
      EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS: JSON.stringify({
        "binding-id": { provider: "stripe", secretKey: "managed-at-runtime" },
      }),
      EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS: JSON.stringify({
        "binding-id": "managed-at-runtime",
      }),
    })).not.toContain("recoveryProviderExecutionSafe");
  });

  it("fails closed when generic provider effects are enabled without managed OAuth rails", () => {
    expect(productionRuntimeConfigurationIssues({
      ...valid,
      EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED: "true",
      EOS_CREDENTIAL_ENCRYPTION_KEY: "invalid",
    })).toContain("integrationProviderExecutionSafe");
    expect(productionRuntimeConfigurationIssues({
      ...valid,
      EOS_INTEGRATION_PROVIDER_EFFECTS_ENABLED: "true",
    })).not.toContain("integrationProviderExecutionSafe");
  });
});
