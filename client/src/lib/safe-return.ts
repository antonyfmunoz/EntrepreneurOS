export function safeInternalReturnPath(value: string | null | undefined, fallback = "/portfolios"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://eos.invalid");
    if (parsed.origin !== "https://eos.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function browserReturnPath(): string {
  return safeInternalReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}
