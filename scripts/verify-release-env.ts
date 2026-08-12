import { productionRuntimeConfiguration } from "../server/security/release-configuration";

const report = {
  ...productionRuntimeConfiguration(),
  clerkBuildPublishableProduction: (process.env.VITE_CLERK_PUBLISHABLE_KEY || "").startsWith("pk_live_"),
  posthogProductionConfigured: Boolean(process.env.VITE_POSTHOG_API_KEY?.startsWith("phc_") && !process.env.VITE_POSTHOG_API_KEY.toLowerCase().includes("placeholder")),
  anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  googleWorkspaceConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI?.startsWith("https://")),
  notionConfigured: Boolean(process.env.NOTION_API_KEY || process.env.NOTION_API_TOKEN),
};

console.log(JSON.stringify(report));
if (Object.values(report).some((configured) => !configured)) process.exitCode = 1;
