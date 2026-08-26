import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../scripts/bootstrap-production-vault.ps1", import.meta.url), "utf8");

describe("production vault bootstrap contract", () => {
  it("uses concealed prompts and a stdin JSON template instead of secret command arguments or files", () => {
    expect(script).toContain("Read-Host $Prompt -AsSecureString");
    expect(script).toContain("ZeroFreeBSTR");
    expect(script).toContain("$payload | op item create --vault $TargetVault -");
    expect(script).not.toContain("--template=");
    expect(script).not.toMatch(/Set-Content|Out-File|Add-Content/);
  });

  it("refuses overwrite and validates production-class Clerk and Stripe credentials", () => {
    expect(script).toContain("bootstrap is create-only");
    expect(script).toContain("^pk_live_");
    expect(script).toContain("^sk_live_");
    expect(script).toContain("^rk_live_");
    expect(script).toContain("^whsec_");
  });

  it("keeps primary and backup artifact authority independent", () => {
    expect(script).toContain("Primary and backup artifact buckets must be different");
    expect(script).toContain('New-Field "EOS_ARTIFACT_S3_ACCESS_KEY_ID"');
    expect(script).toContain('New-Field "EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID"');
    expect(script).toContain('New-Field "EOS_ARTIFACT_S3_KMS_KEY_ID"');
    expect(script).toContain('New-Field "EOS_ARTIFACT_BACKUP_S3_KMS_KEY_ID"');
  });
});
