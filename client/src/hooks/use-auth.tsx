import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged, signOut, Auth } from "firebase/auth";
import { GoogleAuthProvider } from "firebase/auth";

type UserWithoutPassword = Omit<User, "password">;

type AuthContextType = {
  user: UserWithoutPassword | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserWithoutPassword, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<UserWithoutPassword, Error, RegisterData>;
  signInWithGoogle: () => Promise<void>;
  isGoogleSignInAvailable: boolean;
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
  const {
    data: userData,
    error,
    isLoading,
    refetch,
  } = useQuery<UserWithoutPassword | null, Error>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/user");
        
        if (res.status === 401) {
          return null;
        }
        
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        
        const userData = await res.json();
        return userData as UserWithoutPassword;
      } catch (error) {
        // This is likely a network error or something similar
        throw new Error(error instanceof Error ? error.message : "Unknown error");
      }
    },
  });
  
  // Make sure user is never undefined
  const user = userData ?? null;

  // Setup Firebase auth state observer
  useEffect(() => {
    if (isFirebaseConfigured() && auth) {
      try {
        // Need to type assert auth as Auth since we already checked it's not null
        const unsubscribe = onAuthStateChanged(auth as Auth, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              // Call our backend to either login or register the Firebase user
              const res = await apiRequest("POST", "/api/auth/google", {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL
              });
              
              if (res.ok) {
                // Refetch the user data
                refetch();
              } else {
                console.error("Failed to authenticate with backend:", await res.text());
                toast({
                  title: "Authentication Error",
                  description: "Failed to authenticate with the server",
                  variant: "destructive",
                });
              }
            } catch (err) {
              console.error("Error during Firebase auth sync:", err);
              toast({
                title: "Authentication Error",
                description: "Error syncing with Firebase",
                variant: "destructive",
              });
            }
          }
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error("Error setting up Firebase auth state observer:", error);
        toast({
          title: "Firebase Error",
          description: "Could not set up Firebase authentication",
          variant: "destructive",
        });
      }
    } else {
      console.log("Firebase not configured, skipping auth observer setup");
    }
  }, [refetch, toast]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Invalid username or password");
        }
        throw new Error(`Login failed with status: ${res.status}`);
      }
      
      return await res.json();
    },
    onSuccess: (userData: UserWithoutPassword) => {
      queryClient.setQueryData(["/api/user"], userData);
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

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", data);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Registration failed with status: ${res.status}`);
      }
      
      return await res.json();
    },
    onSuccess: (userData: UserWithoutPassword) => {
      queryClient.setQueryData(["/api/user"], userData);
      toast({
        title: "Registration successful",
        description: `Welcome to AgentOS, ${userData.username}!`,
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

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Sign out from Firebase if configured
      if (isFirebaseConfigured() && auth) {
        await signOut(auth).catch(console.error);
      }
      
      // Sign out from our backend
      const res = await apiRequest("POST", "/api/logout");
      
      if (!res.ok) {
        throw new Error(`Logout failed with status: ${res.status}`);
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logged out successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Google Sign In function
  const signInWithGoogle = async (): Promise<void> => {
    if (!isFirebaseConfigured() || !auth || !googleProvider) {
      toast({
        title: "Google Sign In not available",
        description: "Firebase configuration is missing",
        variant: "destructive",
      });
      return;
    }

    try {
      // Type assertion since we already checked these are not null
      await signInWithPopup(auth as Auth, googleProvider as GoogleAuthProvider);
      // The Firebase auth state observer will handle the backend authentication
    } catch (error) {
      toast({
        title: "Google Sign In failed",
        description: error instanceof Error ? error.message : "Unknown error",
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
        isGoogleSignInAvailable: isFirebaseConfigured(),
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