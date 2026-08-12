import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser, useAuth as useClerkAuth, useSignIn } from "@clerk/clerk-react";
import { isClerkConfigured } from "@/lib/clerk";

type UserWithoutPassword = Omit<User, "password">;

type AuthContextType = {
  user: UserWithoutPassword | null;
  isLoading: boolean;
  error: Error | null;
  logoutMutation: UseMutationResult<void, Error, void>;
  resetPassword: (email: string) => Promise<void>;
  isClerkReady: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * AuthProvider — slim Clerk auth context.
 *
 * Login and signup pages call Clerk SDK hooks directly (useSignIn / useSignUp).
 * This provider handles:
 *   - Local DB user row sync (via /api/user query)
 *   - Logout
 *   - Password reset
 *   - isClerkReady flag
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();
  const { signIn } = useSignIn();
  const clerkReady = isClerkConfigured() && clerkLoaded;

  const {
    data: userData,
    error,
    isLoading: queryLoading,
  } = useQuery<UserWithoutPassword | null, Error>({
    queryKey: ["/api/user", clerkUser?.id ?? null],
    enabled: clerkReady && Boolean(clerkUser),
    queryFn: async () => {
      try {
        return await apiRequest<UserWithoutPassword>("/api/user");
      } catch (requestError) {
        if (requestError instanceof Error && requestError.message.startsWith("401:")) return null;
        throw requestError;
      }
    },
  });

  const user = clerkUser ? userData ?? null : null;
  const isLoading = !clerkLoaded || (clerkReady && Boolean(clerkUser) && queryLoading);

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (clerkReady) {
        await clerkSignOut();
      }
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
        logoutMutation,
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
