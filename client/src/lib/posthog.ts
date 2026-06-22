export const posthog = {
  capture(event: string, properties?: Record<string, unknown>) {
    console.log("[PostHog stub]", event, properties);
  },
};
