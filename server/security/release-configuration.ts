type ReleaseEnvironment = Record<string, string | undefined>;

function isManagedPostgres(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && Boolean(url.hostname)
      && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isEncryptionKey(value?: string): boolean {
  try { return Buffer.from(value || "", "base64").length === 32; } catch { return false; }
}

function isHttpsOrigin(value?: string): boolean {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && url.origin === value?.replace(/\/$/, "");
  } catch {
    return false;
  }
}

export function productionRuntimeConfiguration(env: ReleaseEnvironment = process.env) {
  return {
    managedDatabase: isManagedPostgres(env.DATABASE_URL),
    clerkPublishableProduction: Boolean(env.CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_")),
    clerkSecretProduction: Boolean(env.CLERK_SECRET_KEY?.startsWith("sk_live_")),
    sessionSecretStrong: Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32),
    credentialEncryptionConfigured: isEncryptionKey(env.EOS_CREDENTIAL_ENCRYPTION_KEY),
    publicOriginHttps: isHttpsOrigin(env.EOS_PUBLIC_ORIGIN),
  };
}

export function productionRuntimeConfigurationIssues(env: ReleaseEnvironment = process.env): string[] {
  return Object.entries(productionRuntimeConfiguration(env))
    .filter(([, configured]) => !configured)
    .map(([key]) => key);
}
