import { afterEach, describe, expect, it } from "vitest";
import { credentialEncryptionConfigured, decryptCredential, encryptCredential } from "../../server/security/credential-encryption";

afterEach(() => { delete process.env.EOS_CREDENTIAL_ENCRYPTION_KEY; });

describe("provider credential encryption", () => {
  it("round-trips an encrypted credential without storing plaintext", () => {
    process.env.EOS_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptCredential("provider-secret");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("provider-secret");
    expect(decryptCredential(encrypted)).toBe("provider-secret");
  });

  it("fails closed for missing keys and legacy plaintext", () => {
    expect(credentialEncryptionConfigured()).toBe(false);
    expect(() => decryptCredential("legacy-plaintext")).toThrow(/not encrypted/i);
  });
});
