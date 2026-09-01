import { describe, expect, it } from "vitest";
import {
  externalProductionInventoryGaps,
  resolvePlatformAdministratorClerkBindings,
  type ExternalProductionInventorySignals,
} from "../../server/security/external-production-inventory";

const complete: ExternalProductionInventorySignals = {
  github: { defaultBranchCanonical: true, protectedChecksConfigured: true, productionEnvironmentConfigured: true, productionEnvironmentApprovalRequired: true, openCodeScanningAlerts: 0, openDependabotAlerts: 0 },
  fly: { oneImmutableImage: true, releaseSubjectPresent: true, minimumMachineAvailable: true, productionSecretSetComplete: true },
  publicRuntime: { healthOk: true, readinessOk: true, hstsPresent: true, cspPresent: true, tlsValid: true },
  vault: { productionItemExists: true, missingRequiredFields: [], clerkLive: true, clerkPlatformAdministratorsValid: true, credentialEncryptionKeyMatchesRuntime: true, operatingCompanyPaymentsLive: true, primaryArtifactPlanePresent: true, backupArtifactPlanePresent: true, malwareScannerPresent: true, alertReceiverPresent: true },
  providers: { googleCredentialValid: true, gmailRead: true, gmailSend: true, driveRead: true, calendarEvents: true, notionInternalBotValid: true, notionPublicOAuthPresent: true, posthogProjectKeyPresent: true, anthropicCredentialPresent: true },
  database: { reachable: true, migrationCount: 111, targetMigrationCount: 111, vaultCandidateMatchesRuntime: true },
};

describe("external production inventory", () => {
  it("resolves configured EOS administrator IDs through database Clerk bindings", () => {
    expect(resolvePlatformAdministratorClerkBindings(" eos-owner, eos-backup, eos-owner ", [
      { id: "eos-owner", clerkUserId: "user_clerk_owner" },
      { id: "eos-backup", clerkUserId: "user_clerk_backup" },
      { id: "unconfigured", clerkUserId: "user_other" },
    ])).toEqual({
      configuredCount: 2,
      databaseBoundCount: 2,
      clerkUserIds: ["user_clerk_owner", "user_clerk_backup"],
    });
  });

  it("fails closed when a configured EOS administrator lacks a Clerk binding", () => {
    expect(resolvePlatformAdministratorClerkBindings("eos-owner,eos-backup", [
      { id: "eos-owner", clerkUserId: "user_clerk_owner" },
      { id: "eos-backup", clerkUserId: null },
    ])).toEqual({
      configuredCount: 2,
      databaseBoundCount: 1,
      clerkUserIds: ["user_clerk_owner"],
    });
  });

  it("reports no technical inventory gaps only when every observed external control is present", () => {
    expect(externalProductionInventoryGaps(complete)).toEqual([]);
  });

  it("names concrete gaps without collapsing unknown state into a pass", () => {
    const incomplete = structuredClone(complete);
    incomplete.github.openCodeScanningAlerts = null;
    incomplete.fly.releaseSubjectPresent = false;
    incomplete.publicRuntime.cspPresent = false;
    incomplete.vault.productionItemExists = false;
    incomplete.vault.missingRequiredFields = ["CLERK_SECRET_KEY"];
    incomplete.vault.clerkPlatformAdministratorsValid = false;
    incomplete.vault.credentialEncryptionKeyMatchesRuntime = false;
    incomplete.vault.operatingCompanyPaymentsLive = false;
    incomplete.providers.gmailSend = false;
    incomplete.providers.calendarEvents = false;
    incomplete.providers.notionPublicOAuthPresent = false;
    incomplete.database.migrationCount = 9;
    incomplete.database.vaultCandidateMatchesRuntime = false;
    expect(externalProductionInventoryGaps(incomplete)).toEqual(expect.arrayContaining([
      "github_code_scanning_alerts_open_or_unknown",
      "fly_release_subject_missing",
      "public_csp_missing",
      "production_vault_item_missing",
      "production_vault_fields_missing",
      "clerk_platform_administrator_identity_missing",
      "credential_encryption_key_vault_runtime_mismatch",
      "operating_company_payments_missing",
      "google_gmail_send_scope_missing",
      "google_calendar_events_scope_missing",
      "notion_public_oauth_missing",
      "production_database_migration_gap",
      "vault_database_candidate_mismatch",
    ]));
  });
});
