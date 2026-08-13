import { describe, expect, it } from "vitest";
import { productionRuntimeConfigurationIssues, runtimeReleaseSubject } from "../../server/security/release-configuration";

const valid = {
  DATABASE_URL: "postgresql://app:secret@db.example.com/eos?sslmode=require",
  CLERK_PUBLISHABLE_KEY: "pk_live_example",
  CLERK_SECRET_KEY: "sk_live_example",
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
  STRIPE_RESTRICTED_KEY: "rk_live_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  EOS_STRIPE_PLANS: JSON.stringify({ founder: { priceId: "price_example" } }),
  EOS_PLATFORM_ADMIN_USER_IDS: "user_production_admin",
  EOS_RELEASE_SUBJECT: `git:${"a".repeat(40)}`,
  EOS_PRODUCTION_ENVIRONMENT_SUBJECT: "environment:entrepreneuros-production",
};

describe("production runtime configuration", () => {
  it("accepts a complete production identity and managed runtime", () => {
    expect(productionRuntimeConfigurationIssues(valid)).toEqual([]);
    expect(runtimeReleaseSubject(valid)).toBe(valid.EOS_RELEASE_SUBJECT);
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
      EOS_RELEASE_SUBJECT: "latest",
      EOS_PRODUCTION_ENVIRONMENT_SUBJECT: "production",
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
      "platformAdministratorsConfigured",
      "immutableReleaseSubject",
      "productionEnvironmentSubject",
    ]);
    expect(runtimeReleaseSubject({ EOS_RELEASE_SUBJECT: "latest" })).toBeNull();
  });
});
