import { productionDeploymentConfiguration } from "../server/security/release-configuration";

function optionalProviderState(values: Array<string | undefined>): "disabled" | "configured" | "incomplete" {
  const present = values.filter((value) => Boolean(value?.trim())).length;
  if (present === 0) return "disabled";
  return present === values.length ? "configured" : "incomplete";
}

const report = {
  ...productionDeploymentConfiguration(),
  clerkBuildPublishableProduction: (process.env.VITE_CLERK_PUBLISHABLE_KEY || "").startsWith("pk_live_"),
  posthogProductionConfigured: Boolean(process.env.VITE_POSTHOG_API_KEY?.startsWith("phc_") && !process.env.VITE_POSTHOG_API_KEY.toLowerCase().includes("placeholder")),
  anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  googleWorkspaceConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI?.startsWith("https://")),
  notionConfigured: Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET && process.env.NOTION_REDIRECT_URI?.startsWith("https://")),
  quickbooksOAuth: optionalProviderState([
    process.env.QUICKBOOKS_CLIENT_ID,
    process.env.QUICKBOOKS_CLIENT_SECRET,
    process.env.QUICKBOOKS_REDIRECT_URI,
    process.env.QUICKBOOKS_ENVIRONMENT,
  ]),
  slackOAuth: optionalProviderState([
    process.env.SLACK_CLIENT_ID,
    process.env.SLACK_CLIENT_SECRET,
    process.env.SLACK_REDIRECT_URI,
  ]),
  gohighlevelOAuth: optionalProviderState([
    process.env.GOHIGHLEVEL_CLIENT_ID,
    process.env.GOHIGHLEVEL_CLIENT_SECRET,
    process.env.GOHIGHLEVEL_INSTALLATION_URL,
    process.env.GOHIGHLEVEL_REDIRECT_URI,
  ]),
};

console.log(JSON.stringify(report));
const optionalProviders = [report.quickbooksOAuth, report.slackOAuth, report.gohighlevelOAuth];
const requiredChecks = Object.entries(report)
  .filter(([key]) => !["quickbooksOAuth", "slackOAuth", "gohighlevelOAuth"].includes(key))
  .map(([, configured]) => configured);
if (requiredChecks.some((configured) => !configured) || optionalProviders.includes("incomplete")) process.exitCode = 1;
