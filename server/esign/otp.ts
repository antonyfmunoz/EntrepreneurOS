import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const OTP_TTL_MS = 10 * 60_000;

function rootKey(): Buffer {
  const encoded = process.env.EOS_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!encoded && process.env.NODE_ENV === "production")
    throw new Error("EOS_CREDENTIAL_ENCRYPTION_KEY is required for signer verification.");
  return encoded ? Buffer.from(encoded, "base64") : Buffer.from("eos-native-esign-local-test-key", "utf8");
}

function otpKey(): Buffer {
  return createHmac("sha256", rootKey()).update("eos-native-esign-otp-key.v1", "utf8").digest();
}

export function createNativeEsignOtp(): { code: string; expiresAt: Date } {
  return { code: randomInt(0, 1_000_000).toString().padStart(6, "0"), expiresAt: new Date(Date.now() + OTP_TTL_MS) };
}

export function nativeEsignOtpDigest(recipientId: string, code: string): string {
  return createHmac("sha256", otpKey()).update(`${recipientId}\0${code}`, "utf8").digest("hex");
}

export function nativeEsignOtpMatches(recipientId: string, code: string, expectedHex: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return false;
  const actual = Buffer.from(nativeEsignOtpDigest(recipientId, code), "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function nativeEsignOtpEmail(input: { signerName: string; companyName: string; documentTitle: string; code: string; expiresAt: Date }) {
  return {
    subject: `Your ${input.companyName} signing verification code`,
    body: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171717">
      <p>Hello ${escapeHtml(input.signerName)},</p>
      <p>Use this one-time code to verify the email address for <strong>${escapeHtml(input.documentTitle)}</strong>:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${escapeHtml(input.code)}</p>
      <p style="font-size:13px;color:#6b7280">The code expires ${escapeHtml(input.expiresAt.toISOString())}. EntrepreneurOS will never ask you to send this code back by email.</p>
    </div>`,
  };
}
