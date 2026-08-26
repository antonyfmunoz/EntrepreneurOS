import { describe, expect, it } from "vitest";
import { classifyNativeEsignDeliveryFailure, nativeEsignDeliveryEmail } from "../../server/esign/delivery";

describe("native e-sign delivery", () => {
  it("creates a safe signing email without allowing HTML or header injection", () => {
    const email = nativeEsignDeliveryEmail({
      signerName: "<Signer>",
      companyName: "Example & Co",
      documentTitle: "Terms <v1>",
      envelopeSubject: "Please sign\r\nBcc: attacker@example.test",
      envelopeMessage: "Review <carefully>.",
      signingUrl: "https://entrepreneuros.example.test/sign/private-token",
      expiresAt: new Date("2026-08-24T00:00:00.000Z"),
    });
    expect(email.subject).toBe("Please sign Bcc: attacker@example.test");
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.body).toContain("&lt;Signer&gt;");
    expect(email.body).toContain("Example &amp; Co");
    expect(email.body).not.toContain("Review <carefully>");
  });

  it("distinguishes definite authorization failures from uncertain provider outcomes", () => {
    expect(classifyNativeEsignDeliveryFailure(new Error("Gmail not connected. Please connect Gmail first."))).toMatchObject({ state: "failed", code: "gmail_authorization_unavailable" });
    expect(classifyNativeEsignDeliveryFailure(new Error("fetch failed"))).toMatchObject({ state: "uncertain", code: "gmail_delivery_uncertain" });
  });
});
