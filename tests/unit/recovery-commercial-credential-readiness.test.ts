import { afterEach, describe, expect, it } from "vitest";
import { recoveryCommercialBindingCredentialConfigured } from "../../server/integrations/recovery-commercial";

const binding = {
  id: "docusign-binding-fixture",
  providerKey: "docusign",
  providerAccountReference: "docusign-account-fixture",
  credentialReference: "op://EOS/DocuSign/fixture",
};

const originalEnabled = process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED;
const originalCredentials = process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS;

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED;
  else process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED = originalEnabled;
  if (originalCredentials === undefined) delete process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS;
  else process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = originalCredentials;
});

describe("recovery commercial binding credential readiness", () => {
  it("requires an enabled credential mapped to the exact binding", () => {
    process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED = "true";
    process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = JSON.stringify({
      [binding.id]: {
        provider: "docusign",
        integrationKey: "fixture-integration-key",
        userId: "fixture-user-id",
        privateKey: "fixture-private-key",
        oauthBaseUrl: "https://account-d.docusign.com",
        apiBaseUrl: "https://demo.docusign.net",
      },
    });

    expect(recoveryCommercialBindingCredentialConfigured(binding)).toBe(true);
  });

  it("does not treat another provider's credential as readiness for this binding", () => {
    process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED = "true";
    process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = JSON.stringify({
      "another-binding": { provider: "stripe", secretKey: "fixture-key" },
    });

    expect(recoveryCommercialBindingCredentialConfigured(binding)).toBe(false);
  });
});
