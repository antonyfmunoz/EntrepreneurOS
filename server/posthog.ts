import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const validApiKey = Boolean(apiKey?.startsWith("phc_") && !apiKey.toLowerCase().includes("placeholder"));

export const posthogClient = apiKey && validApiKey
  ? new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 20,
      flushInterval: 10_000,
    })
  : null;

export async function shutdownPosthog() {
  await posthogClient?._shutdown(5_000);
}
