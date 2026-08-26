import { describe, expect, it } from "vitest";
import { containsCredentialMaterial } from "../../server/security/credential-material";

describe("credential material boundary", () => {
  it("permits opaque secret-manager references without copying the secret", () => {
    expect(containsCredentialMaterial({ credentialReference: "op://EntrepreneurOS/Gmail/client-secret" })).toBe(false);
    expect(containsCredentialMaterial({ apiKeyReference: "gcp-sm://projects/eos/secrets/provider" })).toBe(false);
  });

  it("rejects nested credentials and private keys", () => {
    expect(containsCredentialMaterial({ nested: { accessToken: "secret-token-value" } })).toBe(true);
    expect(containsCredentialMaterial({ instructions: "Authorization: Bearer abcdefghijklmnop" })).toBe(true);
    const privateKeyFixture = ["-----BEGIN", "PRIVATE KEY-----"].join(" ") + "\nfixture";
    expect(containsCredentialMaterial(privateKeyFixture)).toBe(true);
  });

  it("fails closed on pathological nesting", () => {
    let value: Record<string, unknown> = {};
    for (let index = 0; index < 25; index += 1) value = { nested: value };
    expect(containsCredentialMaterial(value)).toBe(true);
  });
});
