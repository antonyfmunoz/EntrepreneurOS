// client/src/lib/clerk.tsx
// Clerk configuration, helpers, and provider wrapper.

import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";

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

export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  if (!publishableKey) {
    return <>{children}</>;
  }
  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}
