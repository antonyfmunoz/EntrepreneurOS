import posthog from "posthog-js";

const apiKey = import.meta.env.VITE_POSTHOG_API_KEY || import.meta.env.VITE_POSTHOG_KEY;

if (typeof window !== "undefined" && apiKey) {
  posthog.init(apiKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
  (window as typeof window & { posthog?: typeof posthog }).posthog = posthog;
}

export default posthog;
