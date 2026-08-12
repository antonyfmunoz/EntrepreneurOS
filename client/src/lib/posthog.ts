import posthog from "posthog-js";

const apiKey = import.meta.env.VITE_POSTHOG_API_KEY || import.meta.env.VITE_POSTHOG_KEY;
const validApiKey = Boolean(apiKey?.startsWith("phc_") && !apiKey.toLowerCase().includes("placeholder"));

if (typeof window !== "undefined" && apiKey && validApiKey) {
  posthog.init(apiKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
  (window as typeof window & { posthog?: typeof posthog }).posthog = posthog;
}

export default posthog;
