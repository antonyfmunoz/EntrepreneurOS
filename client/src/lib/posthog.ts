import posthog from "posthog-js";

const apiKey = import.meta.env.VITE_POSTHOG_API_KEY || import.meta.env.VITE_POSTHOG_KEY;
const validApiKey = Boolean(apiKey?.startsWith("phc_") && !apiKey.toLowerCase().includes("placeholder"));
let initialized = false;
let consented = false;

export function configureProductAnalytics(consent: boolean): void {
  consented = consent;
  if (!validApiKey || typeof window === "undefined") return;
  if (!initialized && consent) {
    posthog.init(apiKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
      opt_out_capturing_by_default: true,
      persistence: "localStorage+cookie",
    });
    initialized = true;
    posthog.opt_in_capturing();
    (window as typeof window & { posthog?: typeof posthog }).posthog = posthog;
  } else if (initialized && !consent) {
    posthog.opt_out_capturing();
    posthog.reset();
  } else if (initialized && consent) posthog.opt_in_capturing();
}

export function captureProductEvent(event: string, properties?: Record<string, unknown>): void {
  if (initialized && consented && posthog.has_opted_in_capturing()) posthog.capture(event, properties);
}

export default posthog;
