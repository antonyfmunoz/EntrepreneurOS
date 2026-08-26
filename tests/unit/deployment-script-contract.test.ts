import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deployScript = readFileSync(new URL("../../scripts/deploy-fly.ps1", import.meta.url), "utf8");
const rollbackScript = readFileSync(new URL("../../scripts/rollback-fly.ps1", import.meta.url), "utf8");

describe("production deployment script contract", () => {
  it("refuses release-source changes while allowing the ignored local operator settings file", () => {
    expect(deployScript).toContain("git status --porcelain --untracked-files=all");
    expect(deployScript).toContain('$candidatePath -ne ".claude/settings.local.json"');
    expect(deployScript).toContain("Production releases require a clean worktree");
    expect(deployScript.indexOf("git status --porcelain")).toBeLessThan(deployScript.indexOf("git archive --format=tar"));
  });

  it("requires current release-bound backup, migration, restore, rollback, and approval evidence before building", () => {
    const evidence = deployScript.indexOf("npm run release:evidence:verify");
    const build = deployScript.indexOf("--build-only --push");
    expect(deployScript).toContain("EOS_PRODUCTION_PROMOTION_EVIDENCE_PATH");
    expect(deployScript).toContain("--rollback-subject $rollbackSubject");
    expect(evidence).toBeGreaterThan(-1);
    expect(evidence).toBeLessThan(build);
  });

  it("requires an exact app- and commit-bound credential cutover approval", () => {
    expect(deployScript).toContain('$expectedCutoverApproval = "CUTOVER $app $releaseCommit"');
    expect(deployScript).toContain("EOS_SECRET_CUTOVER_APPROVAL");
  });

  it("rejects pre-existing pending Fly secrets", () => {
    const inspection = deployScript.indexOf("Get-FlySecrets -App $app");
    const build = deployScript.indexOf("--build-only --push");
    expect(inspection).toBeGreaterThan(-1);
    expect(deployScript).toContain('$_.status -ne "Deployed"');
    expect(inspection).toBeLessThan(build);
  });

  it("builds the immutable image before staging any credentials", () => {
    const build = deployScript.indexOf("--build-only --push");
    const secretStage = deployScript.indexOf("flyctl secrets set --app $app --stage");
    const promotion = deployScript.indexOf("--image $imageReference --strategy canary");
    expect(build).toBeGreaterThan(-1);
    expect(secretStage).toBeGreaterThan(build);
    expect(promotion).toBeGreaterThan(secretStage);
  });

  it("requires and stages the binding-keyed Recovery provider webhook secret map", () => {
    expect(deployScript.match(/EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS/g)?.length).toBeGreaterThanOrEqual(2);
    expect(deployScript).toContain('"EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS=$env:EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS"');
  });

  it("requires and stages the separately kill-switched Recovery execution credential map", () => {
    expect(deployScript.match(/EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED/g)?.length).toBeGreaterThanOrEqual(2);
    expect(deployScript.match(/EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS/g)?.length).toBeGreaterThanOrEqual(2);
    expect(deployScript).toContain('"EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS=$env:EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS"');
  });

  it("requires and stages both credentialed S3 custody planes and malware scanning", () => {
    for (const name of [
      "EOS_ARTIFACT_STORAGE_PROVIDER",
      "EOS_ARTIFACT_S3_BUCKET",
      "EOS_ARTIFACT_S3_REGION",
      "EOS_ARTIFACT_S3_KMS_KEY_ID",
      "EOS_ARTIFACT_S3_ACCESS_KEY_ID",
      "EOS_ARTIFACT_S3_SECRET_ACCESS_KEY",
      "EOS_ARTIFACT_BACKUP_STORAGE_PROVIDER",
      "EOS_ARTIFACT_BACKUP_S3_BUCKET",
      "EOS_ARTIFACT_BACKUP_S3_REGION",
      "EOS_ARTIFACT_BACKUP_S3_KMS_KEY_ID",
      "EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID",
      "EOS_ARTIFACT_BACKUP_S3_SECRET_ACCESS_KEY",
      "EOS_MALWARE_SCAN_ENDPOINT",
      "EOS_MALWARE_SCAN_SECRET",
    ]) {
      expect(deployScript.match(new RegExp(name, "g"))?.length).toBeGreaterThanOrEqual(2);
      expect(deployScript).toContain(`"${name}=$env:${name}"`);
    }
  });

  it("stages optional transcription credentials only when the kill switch is enabled", () => {
    expect(deployScript).toContain('$env:EOS_CANDIDATE_STT_ENABLED -eq "true"');
    expect(deployScript).toContain('"OPENAI_API_KEY=$env:OPENAI_API_KEY"');
  });

  it("carries provider-ingress and dispatch-recovery worker timing into production", () => {
    for (const name of [
      "EOS_PROVIDER_INGRESS_WORKER_INTERVAL_MS",
      "EOS_INTEGRATION_DISPATCH_RECOVERY_AFTER_MS",
      "EOS_INTEGRATION_DISPATCH_RECOVERY_INTERVAL_MS",
    ]) {
      expect(deployScript.match(new RegExp(name, "g"))?.length).toBeGreaterThanOrEqual(2);
      expect(deployScript).toContain(`"${name}=$env:${name}"`);
    }
  });

  it("qualifies both successful promotion and rollback with public and signed-in smokes", () => {
    expect(deployScript.match(/npm run test:e2e:production\r?\n/g)).toHaveLength(2);
    expect(deployScript.match(/npm run test:e2e:production:authenticated/g)).toHaveLength(2);
    expect(rollbackScript).toContain("npm run test:e2e:production");
    expect(rollbackScript).toContain("npm run test:e2e:production:authenticated");
  });

  it("acquires short-lived Clerk smoke credentials only immediately before authenticated checks", () => {
    expect(deployScript).toContain("Set-FreshProductionBearerToken");
    expect(deployScript).toContain('Read-Host "Paste a fresh Clerk session JWT');
    expect(deployScript).toContain('$env:EOS_PRODUCTION_BEARER_TOKEN = $null');
    const firstPublicSmoke = deployScript.indexOf("npm run test:e2e:production");
    const firstTokenPrompt = deployScript.indexOf("Set-FreshProductionBearerToken", firstPublicSmoke);
    const firstAuthenticatedSmoke = deployScript.indexOf("npm run test:e2e:production:authenticated");
    expect(firstTokenPrompt).toBeGreaterThan(firstPublicSmoke);
    expect(firstTokenPrompt).toBeLessThan(firstAuthenticatedSmoke);
  });
});
