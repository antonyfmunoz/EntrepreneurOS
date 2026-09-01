import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../scripts/configure-company-stripe.ps1", import.meta.url), "utf8");

describe("company Stripe vault configuration script", () => {
  it("binds a live restricted key and webhook secret to one exact Integration Binding", () => {
    expect(script).toContain("exact EOS Stripe Integration Binding UUID");
    expect(script).toContain("^rk_live_");
    expect(script).toContain("^whsec_");
    expect(script).toContain('$executionMap[$bindingId]');
    expect(script).toContain('$webhookMap[$bindingId]');
  });

  it("uses concealed prompts and piped JSON without plaintext files or secret arguments", () => {
    expect(script).toContain("[switch]$ValidateOnly");
    expect(script).toContain("Read-Host $Prompt -AsSecureString");
    expect(script).toContain("ZeroFreeBSTR");
    expect(script).toContain("$payload | op item edit $Item --vault $TargetVault");
    expect(script).not.toMatch(/Set-Content|Out-File|Add-Content/);
    expect(script).not.toContain("--template=");
    expect(script).not.toMatch(/op item edit[^\r\n]*\$restrictedKey/);
    expect(script).not.toMatch(/op item edit[^\r\n]*\$webhookSecret/);
  });
});
