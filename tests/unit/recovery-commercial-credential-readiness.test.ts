import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recoveryCommercialBindingCredentialConfigured, verifyDocusignConnection } from "../../server/integrations/recovery-commercial";

const binding = {
  id: "docusign-binding-fixture",
  providerKey: "docusign",
  providerAccountReference: "docusign-account-fixture",
  credentialReference: "op://EOS/DocuSign/fixture",
};

const originalEnabled = process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED;
const originalCredentials = process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS;

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("verifies only the exact DocuSign account through read-only requests while effects stay disabled", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED = "false";
    process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = JSON.stringify({
      [binding.id]: {
        provider: "docusign",
        integrationKey: "fixture-integration-key",
        userId: "fixture-user-id",
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
        oauthBaseUrl: "https://account-d.docusign.com",
        apiBaseUrl: "https://demo.docusign.net",
      },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/oauth/token"))
        return new Response(JSON.stringify({ access_token: "fixture-token" }), { status: 200 });
      expect(url).toContain(`/restapi/v2.1/accounts/${binding.providerAccountReference}`);
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify({ accountId: binding.providerAccountReference }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyDocusignConnection(binding)).resolves.toMatchObject({
      connected: true,
      healthy: true,
      reason: "ready",
      deliveryVerified: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED).toBe("false");
  });

  it("fails closed without an exact managed DocuSign credential", async () => {
    process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED = "false";
    process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS = JSON.stringify({});
    await expect(verifyDocusignConnection(binding)).resolves.toMatchObject({
      connected: false,
      healthy: false,
      reason: "credential_missing",
    });
  });
});
