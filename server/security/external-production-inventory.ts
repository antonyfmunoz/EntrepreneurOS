export type ExternalProductionInventorySignals = {
  github: {
    defaultBranchCanonical: boolean;
    protectedChecksConfigured: boolean;
    productionEnvironmentConfigured: boolean;
    productionEnvironmentApprovalRequired: boolean;
    openCodeScanningAlerts: number | null;
    openDependabotAlerts: number | null;
  };
  fly: {
    oneImmutableImage: boolean;
    releaseSubjectPresent: boolean;
    minimumMachineAvailable: boolean;
    productionSecretSetComplete: boolean;
  };
  publicRuntime: {
    healthOk: boolean;
    readinessOk: boolean;
    hstsPresent: boolean;
    cspPresent: boolean;
    tlsValid: boolean;
  };
  vault: {
    productionItemExists: boolean;
    missingRequiredFields: string[];
    clerkLive: boolean;
    clerkPlatformAdministratorsValid: boolean;
    credentialEncryptionKeyMatchesRuntime: boolean;
    stripeLive: boolean;
    primaryArtifactPlanePresent: boolean;
    backupArtifactPlanePresent: boolean;
    malwareScannerPresent: boolean;
    alertReceiverPresent: boolean;
  };
  providers: {
    googleCredentialValid: boolean;
    gmailRead: boolean;
    gmailSend: boolean;
    driveRead: boolean;
    calendarEvents: boolean;
    notionInternalBotValid: boolean;
    notionPublicOAuthPresent: boolean;
    posthogProjectKeyPresent: boolean;
    anthropicCredentialPresent: boolean;
  };
  database: {
    reachable: boolean;
    migrationCount: number | null;
    targetMigrationCount: number;
    vaultCandidateMatchesRuntime: boolean;
  };
};

export type PlatformAdministratorIdentityRow = {
  id: string;
  clerkUserId: string | null;
};

export function resolvePlatformAdministratorClerkBindings(
  configuredValue: string | null | undefined,
  users: PlatformAdministratorIdentityRow[],
): { configuredCount: number; databaseBoundCount: number; clerkUserIds: string[] } {
  const configuredIds = Array.from(new Set(
    String(configuredValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const clerkUserIds = configuredIds
    .map((id) => usersById.get(id)?.clerkUserId?.trim() || "")
    .filter(Boolean);
  return {
    configuredCount: configuredIds.length,
    databaseBoundCount: clerkUserIds.length,
    clerkUserIds,
  };
}

export function externalProductionInventoryGaps(
  signals: ExternalProductionInventorySignals,
): string[] {
  const gaps: string[] = [];
  const require = (condition: boolean, code: string) => { if (!condition) gaps.push(code); };

  require(signals.github.defaultBranchCanonical, "github_default_branch_not_canonical");
  require(signals.github.protectedChecksConfigured, "github_protected_checks_missing");
  require(signals.github.productionEnvironmentConfigured, "github_production_environment_missing");
  require(signals.github.productionEnvironmentApprovalRequired, "github_production_approval_missing");
  require(signals.github.openCodeScanningAlerts === 0, "github_code_scanning_alerts_open_or_unknown");
  require(signals.github.openDependabotAlerts === 0, "github_dependabot_alerts_open_or_unknown");
  require(signals.fly.oneImmutableImage, "fly_machine_image_drift");
  require(signals.fly.releaseSubjectPresent, "fly_release_subject_missing");
  require(signals.fly.minimumMachineAvailable, "fly_minimum_machine_not_available");
  require(signals.fly.productionSecretSetComplete, "fly_production_secret_set_incomplete");
  require(signals.publicRuntime.healthOk, "public_health_failed");
  require(signals.publicRuntime.readinessOk, "public_readiness_failed");
  require(signals.publicRuntime.hstsPresent, "public_hsts_missing");
  require(signals.publicRuntime.cspPresent, "public_csp_missing");
  require(signals.publicRuntime.tlsValid, "public_tls_invalid");
  require(signals.vault.productionItemExists, "production_vault_item_missing");
  if (signals.vault.missingRequiredFields.length) gaps.push("production_vault_fields_missing");
  require(signals.vault.clerkLive, "clerk_production_instance_missing");
  require(signals.vault.clerkPlatformAdministratorsValid, "clerk_platform_administrator_identity_missing");
  require(signals.vault.credentialEncryptionKeyMatchesRuntime, "credential_encryption_key_vault_runtime_mismatch");
  require(signals.vault.stripeLive, "stripe_live_configuration_missing");
  require(signals.vault.primaryArtifactPlanePresent, "artifact_primary_plane_missing");
  require(signals.vault.backupArtifactPlanePresent, "artifact_backup_plane_missing");
  require(signals.vault.malwareScannerPresent, "malware_scanner_missing");
  require(signals.vault.alertReceiverPresent, "operational_alert_receiver_missing");
  require(signals.providers.googleCredentialValid, "google_oauth_credential_invalid");
  require(signals.providers.gmailRead, "google_gmail_read_scope_missing");
  require(signals.providers.gmailSend, "google_gmail_send_scope_missing");
  require(signals.providers.driveRead, "google_drive_read_scope_missing");
  require(signals.providers.calendarEvents, "google_calendar_events_scope_missing");
  require(signals.providers.notionInternalBotValid, "notion_internal_reference_invalid");
  require(signals.providers.notionPublicOAuthPresent, "notion_public_oauth_missing");
  require(signals.providers.posthogProjectKeyPresent, "posthog_project_missing");
  require(signals.providers.anthropicCredentialPresent, "anthropic_credential_missing");
  require(signals.database.reachable, "production_database_unreachable");
  require(signals.database.vaultCandidateMatchesRuntime, "vault_database_candidate_mismatch");
  require(
    signals.database.migrationCount === signals.database.targetMigrationCount,
    "production_database_migration_gap",
  );

  return gaps;
}
