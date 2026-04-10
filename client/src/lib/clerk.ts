// client/src/lib/clerk.ts
// Clerk configuration and helpers.

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function getClerkPublishableKey(): string {
  if (!publishableKey) {
    console.warn("[clerk] VITE_CLERK_PUBLISHABLE_KEY not set. Auth will not work.");
    return "";
  }
  return publishableKey;
}

export function isClerkConfigured(): boolean {
  return !!publishableKey;
}
