import { describe, expect, it } from "vitest";
import { productionRuntimeConfigurationIssues } from "../../server/security/release-configuration";

const valid = {
  DATABASE_URL: "postgresql://app:secret@db.example.com/eos?sslmode=require",
  CLERK_PUBLISHABLE_KEY: "pk_live_example",
  CLERK_SECRET_KEY: "sk_live_example",
  SESSION_SECRET: "s".repeat(32),
  EOS_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  EOS_PUBLIC_ORIGIN: "https://entrepreneuros.net",
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
    })).toEqual([
      "managedDatabase",
      "clerkPublishableProduction",
      "clerkSecretProduction",
      "sessionSecretStrong",
      "credentialEncryptionConfigured",
      "publicOriginHttps",
    ]);
  });
});
