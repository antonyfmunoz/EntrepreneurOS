const report = {
  clerkPublishableProduction: (process.env.VITE_CLERK_PUBLISHABLE_KEY || "").startsWith("pk_live_"),
  clerkSecretProduction: (process.env.CLERK_SECRET_KEY || "").startsWith("sk_live_"),
  posthogConfigured: Boolean(process.env.VITE_POSTHOG_API_KEY),
  anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  credentialEncryptionConfigured: Boolean(process.env.EOS_CREDENTIAL_ENCRYPTION_KEY),
};

console.log(JSON.stringify(report));
if (!Object.values(report).every(Boolean)) process.exitCode = 1;
