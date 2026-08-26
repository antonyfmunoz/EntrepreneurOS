export function encodeNativeEsignHeader(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8_192)
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + 8_192)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export const encodeNativeEsignFieldSchema = encodeNativeEsignHeader;

export function nativeEsignErrorMessage(action: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const payload = JSON.parse(raw.slice(jsonStart));
      if (typeof payload?.message === "string") return `${action}: ${payload.message}`;
    } catch {}
  }
  return `${action}: ${raw || "The request did not complete."}`;
}
