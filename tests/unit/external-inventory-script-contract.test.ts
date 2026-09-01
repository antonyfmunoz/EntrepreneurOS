import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  new URL("../../scripts/production-external-inventory.ts", import.meta.url),
  "utf8",
);

describe("production external inventory script contract", () => {
  it("labels the receipt as partial read-only observation and fails while gaps remain", () => {
    expect(script).toContain('scope: "read_only_external_observation"');
    expect(script).toContain('productionEvidence: "partial_observation_only"');
    expect(script).toContain("if (evidence.gaps.length) process.exitCode = 2");
  });

  it("writes the receipt and digest with owner-only permissions", () => {
    expect(script).toMatch(/writeFile\(outputPath,[\s\S]*mode: 0o600/);
    expect(script).toMatch(/writeFile\(`\$\{outputPath\}\.sha256`[\s\S]*mode: 0o600/);
  });

  it("records only credential presence or class and never serializes credential values", () => {
    expect(script).toContain("sourceCredentialClasses");
    expect(script).toContain("missingRequiredFields");
    expect(script).not.toMatch(/productionFields:\s*Object\.fromEntries/);
    expect(script).not.toMatch(/sourcePosthog:\s*Object\.fromEntries/);
    expect(script).not.toMatch(/sourceAnthropic:\s*Object\.fromEntries/);
  });

  it("distinguishes the runtime database from the legacy vault candidate", () => {
    expect(script).toContain("runtimeDatabaseObservation");
    expect(script).toContain("vaultDatabaseCandidate");
    expect(script).toContain("vaultCandidateMatchesRuntime");
    expect(script).toContain("database: { runtime: runtimeDatabase, vaultCandidate: vaultDatabaseCandidate, vaultCandidateMatchesRuntime }");
  });

  it("accepts the least-privilege Drive metadata scope requested by the EOS adapter", () => {
    expect(script).toContain('googleScopes.has("https://www.googleapis.com/auth/drive.metadata.readonly")');
  });

  it("checks company-scoped Stripe authority instead of EOS subscription plans", () => {
    expect(script).toContain("operatingCompanyPaymentsConfigured");
    expect(script).toContain("operatingCompanyPaymentsLive");
    expect(script).not.toContain('"STRIPE_RESTRICTED_KEY", "STRIPE_WEBHOOK_SECRET", "EOS_STRIPE_PLANS"');
  });

  it("verifies the production administrator's EOS-owned Google OAuth connection", () => {
    expect(script).toContain("runtimeGoogleObservation");
    expect(script).toContain("FROM oauth_tokens");
    expect(script).toContain("provider = 'gmail'");
    expect(script).toContain("EOS_CREDENTIAL_ENCRYPTION_KEY");
    expect(script).toContain("calendars/primary/events");
    expect(script).toContain("googleAdministratorCounts");
    expect(script).not.toContain("op://UMH-Production/Google-Workspace-OAuth");
  });

  it("fails closed when the vault encryption key differs from the live runtime", () => {
    expect(script).toContain("credentialEncryptionKeyMatchesRuntime");
    expect(script).toContain("google.encryptionKeySha256");
    expect(script).not.toContain("encryptionKeySha256: google.encryptionKeySha256");
  });

  it("distinguishes staged Fly credentials from credentials that are absent", () => {
    expect(script).toContain("stagedRequiredSecretNames");
    expect(script).toContain("absentRequiredSecretNames");
    expect(script).toContain("stagedFlySecretNames");
    expect(script).toContain("observedFlySecretNames");
  });

  it("validates configured platform administrators in the production Clerk instance without serializing identities", () => {
    expect(script).toContain("clerkPlatformAdministratorsObservation");
    expect(script).toContain("resolvePlatformAdministratorClerkBindings");
    expect(script).toContain("databaseBoundCount");
    expect(script).toContain("clerkPlatformAdministratorCounts");
    expect(script).not.toContain("clerkPlatformAdministratorIdentifiers");
  });
});
