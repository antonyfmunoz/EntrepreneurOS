import { describe, expect, it } from "vitest";
import { hasExpectedImageSignature } from "../../client/src/components/native-esign-signature-capture";

describe("native e-sign uploaded signature image boundary", () => {
  it("accepts exact PNG and JPEG byte signatures", () => {
    expect(hasExpectedImageSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(hasExpectedImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
  });

  it("rejects mismatched, truncated, and unsupported content", () => {
    expect(hasExpectedImageSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/png")).toBe(false);
    expect(hasExpectedImageSignature(new Uint8Array([0x89, 0x50]), "image/png")).toBe(false);
    expect(hasExpectedImageSignature(new Uint8Array([0xff, 0xd8, 0xff]), "image/svg+xml")).toBe(false);
  });
});
