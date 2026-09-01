import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../scripts/bootstrap-production-vault.ps1", import.meta.url), "utf8");
const environmentTemplate = readFileSync(new URL("../../.env.production.op.tpl", import.meta.url), "utf8");

describe("production vault bootstrap contract", () => {
  it("uses concealed prompts and a stdin JSON template instead of secret command arguments or files", () => {
    expect(script).toContain("Read-Host $Prompt -AsSecureString");
    expect(script).toContain("ZeroFreeBSTR");
    expect(script).toContain("$payload | op item create --vault $TargetVault -");
    expect(script).not.toContain("--template=");
    expect(script).not.toMatch(/Set-Content|Out-File|Add-Content/);
  });

  it("refuses overwrite and validates production-class Clerk credentials without creating EOS SaaS billing", () => {
    expect(script).toContain("bootstrap is create-only");
    expect(script).toContain('Read-Managed "op://$SourceVault/EOS-Clerk/publishable_key"');
    expect(script).toContain('Read-Managed "op://$SourceVault/EOS-Clerk/secret_key"');
    expect(script).not.toContain('Read-Concealed "Paste the Clerk production');
    expect(script).toContain("^pk_live_");
    expect(script).toContain("^sk_live_");
    expect(script).not.toContain('New-Field "STRIPE_RESTRICTED_KEY"');
    expect(script).not.toContain('New-Field "STRIPE_WEBHOOK_SECRET"');
    expect(script).not.toContain('New-Field "EOS_STRIPE_PLANS"');
    expect(script).toContain('New-Field "EOS_RECOVERY_PROVIDER_WEBHOOK_SECRETS" "{}"');
    expect(script).toContain('New-Field "EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS" "{}"');
  });

  it("declares internal operator mode in the production environment", () => {
    expect(environmentTemplate).toContain("EOS_PUBLIC_PAID_SAAS=false");
    expect(environmentTemplate).toContain("EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=true");
    expect(environmentTemplate).not.toContain("STRIPE_RESTRICTED_KEY=op://EntrepreneurOS/Production");
    expect(environmentTemplate).not.toContain("EOS_STRIPE_PLANS=op://EntrepreneurOS/Production");
  });

  it("requires the exact production database instead of copying the legacy neondb credential", () => {
    expect(script).toContain('Read-Concealed "Paste the exact production Neon application-role DATABASE_URL"');
    expect(script).toContain("$databaseName -ne 'eos_db'");
    expect(script).toContain("$databaseRole -ne 'eos_app'");
    expect(script).toContain('Read-Managed "op://$SourceVault/Database-Neon/url"');
    expect(script).toContain("$migrationDatabaseBuilder.Path = 'eos_db'");
    expect(script).toContain('New-Field "MIGRATION_DATABASE_URL"');
  });

  it("keeps primary and backup artifact authority independent", () => {
    expect(script).toContain("Primary and backup artifact buckets must be different");
    expect(script).toContain('New-Field "EOS_ARTIFACT_S3_ACCESS_KEY_ID"');
    expect(script).toContain('New-Field "EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID"');
    expect(script).toContain('New-Field "EOS_ARTIFACT_S3_SSE_CUSTOMER_KEY" (New-RandomBase64 32)');
    expect(script).toContain('New-Field "EOS_ARTIFACT_BACKUP_S3_SSE_CUSTOMER_KEY" (New-RandomBase64 32)');
    expect(script).toContain('New-Field "EOS_ARTIFACT_S3_ENDPOINT"');
    expect(script).toContain('New-Field "EOS_ARTIFACT_BACKUP_S3_ENDPOINT"');
  });

  it("declares the authoritative production DNS provider observed at the domain", () => {
    expect(script).toContain('New-Field "EOS_DNS_VENDOR_NAME" "Squarespace Domains"');
    expect(script).not.toContain('New-Field "EOS_DNS_VENDOR_NAME" "Cloudflare"');
  });

  it("custodies dedicated EOS Google and Notion OAuth clients in the production item", () => {
    for (const provider of ["GOOGLE", "NOTION"]) {
      expect(script).toContain(`New-Field "${provider}_CLIENT_ID"`);
      expect(script).toContain(`New-Field "${provider}_CLIENT_SECRET"`);
      expect(environmentTemplate).toContain(`${provider}_CLIENT_ID=op://EntrepreneurOS/Production/${provider}_CLIENT_ID`);
      expect(environmentTemplate).toContain(`${provider}_CLIENT_SECRET=op://EntrepreneurOS/Production/${provider}_CLIENT_SECRET`);
    }
    expect(environmentTemplate).not.toContain("op://UMH-Production/Google-Workspace-OAuth");
  });
});
