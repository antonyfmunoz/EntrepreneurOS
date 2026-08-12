const report = {
  clerkPublishableProduction: (process.env.VITE_CLERK_PUBLISHABLE_KEY || "").startsWith("pk_live_"),
  clerkSecretProduction: (process.env.CLERK_SECRET_KEY || "").startsWith("sk_live_"),
  posthogProductionConfigured: Boolean(process.env.VITE_POSTHOG_API_KEY?.startsWith("phc_") && !process.env.VITE_POSTHOG_API_KEY.toLowerCase().includes("placeholder")),
  anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  credentialEncryptionConfigured: Boolean(process.env.EOS_CREDENTIAL_ENCRYPTION_KEY),
};

console.log(JSON.stringify(report));
if (!report.clerkPublishableProduction || !report.clerkSecretProduction || !report.anthropicConfigured || !report.credentialEncryptionConfigured) process.exitCode = 1;
