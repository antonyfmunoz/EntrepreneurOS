import { createContext, ReactNode, useContext, useEffect } from "react";
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
  username: string;
  password: string;
  email: string;
  fullName?: string;
  company?: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut, getToken } = useClerkAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const clerkReady = isClerkConfigured() && clerkLoaded;

  const {
    data: userData,
    error,
    isLoading: queryLoading,
  } = useQuery<UserWithoutPassword | null, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user");
        if (res.status === 401) return null;
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return await res.json();
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : "Unknown error");
      }
    },
  });

  const user = userData ?? null;
  const isLoading = queryLoading || (isClerkConfigured() && !clerkLoaded);

  // Sync Clerk user to backend when Clerk auth state changes
  useEffect(() => {
    if (!clerkReady || !clerkUser) return;
    const syncClerkUser = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiRequest("POST", "/api/auth/clerk", { token });
        if (res.ok) {
          const userData = await res.json();
          queryClient.setQueryData(["/api/user"], userData);
        }
      } catch (err) {
        console.error("Error syncing Clerk user:", err);
      }
    };
    syncClerkUser();
  }, [clerkUser?.id, clerkReady]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Try Clerk first if configured
      if (clerkReady && signIn) {
        try {
          const result = await signIn.create({
            identifier: credentials.username,
            password: credentials.password,
          });
          if (result.status === "complete") {
            // Clerk handles session — sync will happen via useEffect
            const token = await getToken();
            if (token) {
              const res = await apiRequest("POST", "/api/auth/clerk", { token });
              if (res.ok) return await res.json();
            }
          }
          throw new Error("Sign in not complete. Check your email for verification.");
        } catch (err: any) {
          if (err.errors?.[0]?.message) {
            throw new Error(err.errors[0].message);
          }
          throw err;
        }
      }
      // Fallback to local auth
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid username or password");
        throw new Error(`Login failed with status: ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: (userData: UserWithoutPassword) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({ title: "Login successful", description: `Welcome back, ${userData.username}!` });
    },
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      // Try Clerk first if configured
      if (clerkReady && signUp) {
        try {
          const result = await signUp.create({
            username: data.username,
            emailAddress: data.email,
            password: data.password,
            firstName: data.fullName?.split(" ")[0],
            lastName: data.fullName?.split(" ").slice(1).join(" "),
          });
          if (result.status === "complete") {
            const token = await getToken();
            if (token) {
              const res = await apiRequest("POST", "/api/auth/clerk", { token });
              if (res.ok) return await res.json();
            }
          }
          // May need email verification
          if (result.status === "missing_requirements") {
            toast({
              title: "Check your email",
              description: "Please verify your email address to complete registration.",
            });
          }
          throw new Error("Registration requires email verification. Check your inbox.");
        } catch (err: any) {
          if (err.errors?.[0]?.message) {
            throw new Error(err.errors[0].message);
          }
          throw err;
        }
      }
      // Fallback to local auth
      const res = await apiRequest("POST", "/api/register", data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Registration failed with status: ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: (userData: UserWithoutPassword) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({ title: "Account created", description: `Welcome, ${userData.username}!` });
    },
    onError: (error: Error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (clerkReady) {
        await clerkSignOut();
      }
      const res = await apiRequest("POST", "/api/logout");
      if (!res.ok) throw new Error(`Logout failed with status: ${res.status}`);
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({ title: "Logged out successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Logout failed", description: error.message, variant: "destructive" });
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
        description: error.errors?.[0]?.message || "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
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
