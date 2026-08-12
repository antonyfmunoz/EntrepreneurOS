import { describe, expect, it } from "vitest";
import { productionRuntimeConfigurationIssues } from "../../server/security/release-configuration";

const valid = {
  DATABASE_URL: "postgresql://app:secret@db.example.com/eos?sslmode=require",
  CLERK_PUBLISHABLE_KEY: "pk_live_example",
  CLERK_SECRET_KEY: "sk_live_example",
  SESSION_SECRET: "s".repeat(32),
  EOS_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
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
};

describe("production runtime configuration", () => {
  it("accepts a complete production identity and managed runtime", () => {
    expect(productionRuntimeConfigurationIssues(valid)).toEqual([]);
  });

  it("rejects development identity, local storage, weak secrets, and insecure origins", () => {
    expect(productionRuntimeConfigurationIssues({
      ...valid,
      DATABASE_URL: "postgresql://localhost/eos",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_SECRET_KEY: "sk_test_example",
      SESSION_SECRET: "short",
      EOS_CREDENTIAL_ENCRYPTION_KEY: "invalid",
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
    })).toEqual([
      "managedDatabase",
      "clerkPublishableProduction",
      "clerkSecretProduction",
      "sessionSecretStrong",
      "credentialEncryptionConfigured",
      "publicOriginHttps",
      "operationalAlertsConfigured",
      "accountDeletionEnabled",
      "legalEnforcementEnabled",
      "paidSaasEnabled",
      "billingConfigured",
      "platformAdministratorsConfigured",
    ]);
  });
});
