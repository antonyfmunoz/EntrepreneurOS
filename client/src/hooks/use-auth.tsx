import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser, useAuth as useClerkAuth, useSignIn, useSignUp } from "@clerk/clerk-react";
import { isClerkConfigured } from "@/lib/clerk";

type UserWithoutPassword = Omit<User, "password">;

type AuthContextType = {
  user: UserWithoutPassword | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserWithoutPassword, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserWithoutPassword, Error, RegisterData>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isClerkReady: boolean;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  password: string;
  email: string;
  fullName?: string;
  company?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * AuthProvider — Clerk-only auth context.
 *
 * The legacy Passport local + scrypt path has been removed. Every auth
 * mutation now goes through Clerk's React SDK (useSignIn / useSignUp /
 * useClerkAuth.signOut). The server-side user row is synced lazily on the
 * first authenticated request to /api/user via attachClerkUser middleware —
 * no explicit POST /api/auth/clerk round-trip from the frontend is needed.
 *
 * The context surface (user / loginMutation / registerMutation / etc.) is
 * preserved so existing consumers (auth-page.tsx, settings-page.tsx,
 * sidebar.tsx, protected-route.tsx) continue to compile unchanged.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut, getToken } = useClerkAuth();
  const { signIn, setActive: setActiveFromSignIn } = useSignIn();
  const { signUp, setActive: setActiveFromSignUp } = useSignUp();
  const clerkReady = isClerkConfigured() && clerkLoaded;

  // The backend /api/user endpoint reads the Clerk session from cookies via
  // attachClerkUser and returns the local user row. When Clerk is still
  // loading or the user is signed out, we skip the query to avoid a wasted
  // 401. Refetch whenever Clerk auth state flips.
  const {
    data: userData,
    error,
    isLoading: queryLoading,
  } = useQuery<UserWithoutPassword | null, Error>({
    queryKey: ["/api/user", clerkUser?.id ?? null],
    enabled: clerkReady && Boolean(clerkUser),
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    },
  });

  const user = clerkUser ? userData ?? null : null;
  const isLoading = !clerkLoaded || (clerkReady && Boolean(clerkUser) && queryLoading);

  const loginMutation = useMutation<UserWithoutPassword, Error, LoginData>({
    mutationFn: async (credentials: LoginData) => {
      if (!clerkReady || !signIn) {
        throw new Error("Authentication is not available — Clerk is not configured");
      }
      try {
        const result = await signIn.create({
          identifier: credentials.username,
          password: credentials.password,
        });
        if (result.status !== "complete") {
          throw new Error("Sign in not complete — check your email for verification");
        }
        // Activate the new session and grab its JWT for the immediate fetch
        // (the Clerk cookie hasn't propagated yet).
        await setActiveFromSignIn!({ session: result.createdSessionId });
        const token = await getToken();
        const res = await fetch("/api/user", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
        return await res.json();
      } catch (err: any) {
        // If a session already exists, the user is already logged in — fetch
        // the local user row and treat it as a successful login.
        const errMsg = err?.errors?.[0]?.message ?? err?.message ?? "";
        if (errMsg.toLowerCase().includes("session already exists") ||
            errMsg.toLowerCase().includes("single session mode")) {
          const token = await getToken();
          const res = await fetch("/api/user", {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (res.ok) return await res.json();
        }
        if (err?.errors?.[0]?.message) {
          throw new Error(err.errors[0].message);
        }
        throw err;
      }
    },
    onSuccess: (userData: UserWithoutPassword) => {
      queryClient.setQueryData(["/api/user", clerkUser?.id ?? null], userData);
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation<UserWithoutPassword, Error, RegisterData>({
    mutationFn: async (data: RegisterData) => {
      if (!clerkReady || !signUp) {
        throw new Error("Registration is not available — Clerk is not configured");
      }
      try {
        const firstName = data.fullName?.split(" ")[0];
        const lastName = data.fullName?.split(" ").slice(1).join(" ");
        const result = await signUp.create({
          emailAddress: data.email,
          password: data.password,
          firstName,
          lastName,
        });
        if (result.status !== "complete") {
          toast({
            title: "Check your email",
            description:
              "Please verify your email address to complete registration.",
          });
          throw new Error(
            "Registration requires email verification — check your inbox",
          );
        }
        await setActiveFromSignUp!({ session: result.createdSessionId });
        const token = await getToken();
        const res = await fetch("/api/user", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
        return await res.json();
      } catch (err: any) {
        console.error('Clerk signup error:', JSON.stringify(err, null, 2));
        if (err?.errors?.[0]?.message) {
          throw new Error(err.errors[0].message);
        }
        throw err;
      }
    },
    onSuccess: (userData: UserWithoutPassword) => {
      queryClient.setQueryData(["/api/user", clerkUser?.id ?? null], userData);
      toast({
        title: "Account created",
        description: `Welcome, ${userData.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (clerkReady) {
        await clerkSignOut();
      }
      // Server no-op for parity; cookie cleanup happens client-side via Clerk.
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user", null], null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Logged out successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const signInWithGoogle = async (): Promise<void> => {
    if (!clerkReady || !signIn) {
      toast({
        title: "Google Sign In not available",
        description: "Clerk is not configured",
        variant: "destructive",
      });
      return;
    }
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (error) {
      toast({
        title: "Google Sign In failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    if (!clerkReady || !signIn) {
      toast({
        title: "Not available",
        description: "Clerk is not configured",
        variant: "destructive",
      });
      return;
    }
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      toast({
        title: "Password reset email sent",
        description: "Check your inbox for a reset code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error?.errors?.[0]?.message || "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error: error ?? null,
        loginMutation,
        logoutMutation,
        registerMutation,
        signInWithGoogle,
        resetPassword,
        isClerkReady: clerkReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
