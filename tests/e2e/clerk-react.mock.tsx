import type { ReactNode } from "react";

const browserUser = {
  id: "eos_browser_acceptance_owner",
  firstName: "EOS",
  lastName: "Owner",
  fullName: "EOS Owner",
  imageUrl: "",
  emailAddresses: [{ emailAddress: "browser-owner@example.test" }],
};

export function ClerkProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export function ClerkLoaded({ children }: { children: ReactNode }) { return <>{children}</>; }
export function ClerkLoading() { return null; }
export function useUser() { return { isLoaded: true, isSignedIn: true, user: browserUser }; }
export function useAuth() { return { getToken: async () => "e2e-browser-token", signOut: async () => undefined }; }
export function useSignIn() { return { signIn: null, isLoaded: true }; }
export function useOrganization() { return { organization: null, isLoaded: true }; }
export function useOrganizationList() { return { userMemberships: { data: [] }, setActive: async () => undefined, isLoaded: true }; }
export function SignIn() { return <div>EOS browser fixture sign in</div>; }
export function SignUp() { return <div>EOS browser fixture sign up</div>; }
