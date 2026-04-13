import { useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Bot, Terminal, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { usePostHog } from "posthog-js/react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const posthog = usePostHog();
  const { user, isLoading, loginMutation, signInWithGoogle, isClerkReady } =
    useAuth();
  const [, navigate] = useLocation();

  // If already authenticated, bounce to the portfolios list. This covers
  // users who land on /login by accident after logging in elsewhere.
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/portfolios");
    }
  }, [user, isLoading, navigate]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginFormValues) {
    loginMutation.mutate(
      { username: values.email, password: values.password },
      {
        onSuccess: () => {
          navigate("/portfolios");
        },
      },
    );
  }

  const isPending = loginMutation.isPending;
  const serverError = loginMutation.error?.message ?? null;
  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;
  const displayError = serverError ?? emailError ?? passwordError ?? null;

  return (
    <Layout title="Sign In">
      <div className="bg-surface-container-low min-h-screen flex items-center justify-center p-6 selection:bg-primary-fixed selection:text-primary">
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] pointer-events-none"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px] pointer-events-none"></div>

        <main className="w-full max-w-[480px] z-10">
          <div className="flex flex-col items-center mb-12 space-y-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-surface-container-lowest shadow-md text-primary-container">
              <Bot className="w-9 h-9" />
            </div>
            <h1 className="text-[2.25rem] font-semibold tracking-[-0.02em] text-on-surface leading-tight">
              Lucid
            </h1>
            <p className="text-on-surface-variant text-sm font-medium tracking-wide">
              THE ETHEREAL PROFESSIONAL
            </p>
          </div>

          <div className="bg-white/70 backdrop-blur-[16px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] rounded-[24px] p-10 md:p-12 outline outline-1 outline-[rgba(171,173,174,0.1)]">
            <header className="mb-10 text-center">
              <h2 className="text-2xl font-semibold text-on-surface mb-2">
                Welcome Back
              </h2>
              <p className="text-on-surface-variant text-[0.875rem] leading-relaxed">
                Sign in to continue building the future.
              </p>
            </header>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="block text-[0.75rem] font-semibold uppercase tracking-widest text-on-surface-variant px-1"
                >
                  Email Address
                </Label>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@architecture.ai"
                    autoComplete="email"
                    disabled={isPending}
                    className="w-full h-14 px-5 bg-surface-container-highest border-0 rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-outline text-on-surface"
                    {...form.register("email")}
                  />
                  <div className="absolute inset-0 rounded-xl outline outline-1 outline-[rgba(171,173,174,0.1)] pointer-events-none"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <Label
                    htmlFor="password"
                    className="block text-[0.75rem] font-semibold uppercase tracking-widest text-on-surface-variant"
                  >
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-[0.75rem] font-medium text-primary hover:text-primary-container transition-colors"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative group">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isPending}
                    className="w-full h-14 px-5 bg-surface-container-highest border-0 rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all duration-300 placeholder:text-outline text-on-surface"
                    {...form.register("password")}
                  />
                  <div className="absolute inset-0 rounded-xl outline outline-1 outline-[rgba(171,173,174,0.1)] pointer-events-none"></div>
                </div>
              </div>

              {displayError && (
                <div className="flex items-start gap-3 px-1 py-1">
                  <AlertCircle className="w-[18px] h-[18px] text-error mt-0.5 flex-shrink-0" />
                  <p className="text-[0.8125rem] text-error font-medium leading-tight">
                    {displayError}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-14 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] text-white font-semibold rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 tracking-wide mt-4 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign Into Console"
                )}
              </Button>
            </form>

            <footer className="mt-10 text-center">
              <p className="text-on-surface-variant text-[0.875rem]">
                New to the architecture?
                <Link
                  href="/signup"
                  className="text-primary font-semibold hover:underline decoration-2 underline-offset-4 ml-1 transition-all"
                >
                  Create Account
                </Link>
              </p>
            </footer>
          </div>

          <div className="mt-8 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 w-full">
              <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
              <span className="text-[0.75rem] font-medium text-outline uppercase tracking-widest">
                Or continue with
              </span>
              <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
            </div>

            <div className="flex gap-4 w-full">
              <Button
                type="button"
                variant="outline"
                disabled={!isClerkReady || isPending}
                onClick={() => void signInWithGoogle()}
                className="flex-1 h-12 flex items-center justify-center gap-2 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] outline outline-1 outline-[rgba(171,173,174,0.1)] hover:bg-surface-container-low transition-all"
              >
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBDhbDpyyrKXpoJLq15x5MpT6UVjgvkrrnQP26rmwOCiImww1bzVgEU_B9UT0RnJvxE4HvXs69t-Xk410QwbDf4NvxuOSqaGUq1uE5vqWbNAzk6Yzzylw397vTyI4J08z5aM9ZoG4UvvXJG5hoKbxEY-g1IFlSbqZS99rwWqU0B8cRhzbvAZMPewembneCQ7PH7UP4v-zw6ay8rGPsQDc-Vx4jythLvcy812vjOm-1_TNzrCZsFUt2MTLuOWC7DyCVLZMbheI6wWJA"
                  alt="Google"
                  className="w-5 h-5 opacity-80"
                />
                <span className="text-[0.875rem] font-medium text-on-surface">
                  Google
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled
                className="flex-1 h-12 flex items-center justify-center gap-2 bg-surface-container-lowest rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] outline outline-1 outline-[rgba(171,173,174,0.1)] hover:bg-surface-container-low transition-all opacity-50"
                title="GitHub sign-in coming soon"
              >
                <Terminal className="w-5 h-5 text-on-surface" />
                <span className="text-[0.875rem] font-medium text-on-surface">
                  GitHub
                </span>
              </Button>
            </div>
          </div>
        </main>

        <div className="fixed bottom-8 text-outline text-[0.6875rem] tracking-[0.2em] font-medium uppercase text-center w-full">
          Architected by Lucid Systems — V 2.4.0
        </div>
      </div>
    </Layout>
  );
}
