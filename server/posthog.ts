export const posthogClient = { 
  capture(opts: { distinctId: string; event: string; properties?: Record<string, unknown> }) { 
    console.log("[PostHog server stub]", opts.event, opts.properties); 
  }, 
};
