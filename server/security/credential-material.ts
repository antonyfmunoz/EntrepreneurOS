const credentialReference = /^(?:op|vault|secret|aws-sm|gcp-sm):\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/;
const secretValue = /(?:bearer\s+[a-z0-9._~+\/-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*[^\s]{6,})/i;
const secretKey = /^(?:password|secret|token|credential|privateKey|apiKey|accessToken|refreshToken|clientSecret)$/i;

export function containsCredentialMaterial(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (typeof value === "string") return credentialReference.test(value) ? false : secretValue.test(value);
  if (Array.isArray(value)) return value.some((item) => containsCredentialMaterial(item, depth + 1));
  if (value && typeof value === "object") return Object.entries(value).some(([key, item]) => secretKey.test(key) ? item !== null && item !== "" : containsCredentialMaterial(item, depth + 1));
  return false;
}
