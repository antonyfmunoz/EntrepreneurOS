import { useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Bot, AlertCircle, Loader2 } from "lucide-react";

import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { usePostHog } from "posthog-js/react";

const signupSchema = z.object({
  fullName: z
    .string()
    .min(2, "Please enter your full name")
    .max(100, "Name is too long"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(256, "Password is too long"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

// Derive a username from the email — Clerk requires a unique username and
// asking the user for one just adds friction. Local-part of the email is
// the simplest stable default; downstream code can let users rename later.
function deriveUsernameFromEmail(email: string): string {
  const posthog = usePostHog();
  const local = email.split("@")[0] || "user";
  const suffix = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${local.replace(/[^a-zA-Z0-9_-]/g, "")}_${suffix}`;
}

// Very rough password strength signal — purely advisory for the progress bar.
function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels = ["None", "Weak", "Medium", "Strong", "Very strong"];
  return { score: clamped, label: labels[clamped] };
}

export default function Signup() {
  const { user, isLoading, registerMutation } = useAuth();
  const [, navigate] = useLocation();

  // If already signed in, push to company setup (or straight to portfolios
  // if a company already exists — the company-setup ProtectedRoute will
  // redirect to /portfolios in that case).
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/company-setup");
    }
  }, [user, isLoading, navigate]);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const passwordValue = form.watch("password");
  const strength = passwordStrength(passwordValue ?? "");

  function onSubmit(values: SignupFormValues) {
    registerMutation.mutate(
      {
        username: deriveUsernameFromEmail(values.email),
        email: values.email,
        password: values.password,
        fullName: values.fullName,
      },
      {
        onSuccess: () => {
          navigate("/company-setup");
        },
      },
    );
  }

  const isPending = registerMutation.isPending;
  const serverError = registerMutation.error?.message ?? null;
  const nameError = form.formState.errors.fullName?.message;
  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;
  const displayError =
    serverError ?? nameError ?? emailError ?? passwordError ?? null;

  return (
    <Layout title="Signup">
      <div className="min-h-screen flex flex-col items-center justify-center selection:bg-primary-fixed selection:text-primary overflow-x-hidden bg-background">
        <main className="flex-grow flex items-center justify-center w-full px-6 py-12">
          <div className="w-full max-w-[480px] flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] flex items-center justify-center shadow-[0_8px_32px_rgba(106,55,212,0.08)] transform transition-transform duration-300 group-hover:scale-105">
                <Bot className="text-white w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-primary">
                Lucid
              </h2>
            </div>

            <div className="bg-white/70 backdrop-blur-[16px] shadow-[0_8px_32px_rgba(106,55,212,0.08)] rounded-xl p-8 w-full">
              <header className="mb-8 text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-on-surface mb-2">
                  Join the Architecture
                </h1>
                <p className="text-on-surface-variant leading-relaxed text-sm">
                  Experience the clarity of vision with our automated insights engine.
                </p>
              </header>

              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {displayError && (
                  <Alert className="flex items-center gap-3 p-4 bg-error-container/30 rounded-lg text-on-error-container text-sm border-none">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{displayError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Full Name
                    </Label>
                    <Input
                      type="text"
                      autoComplete="name"
                      disabled={isPending}
                      placeholder="John Architect"
                      className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant"
                      {...form.register("fullName")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Mail Address
                    </Label>
                    <Input
                      type="email"
                      autoComplete="email"
                      disabled={isPending}
                      placeholder="hello@lucid.design"
                      className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant"
                      {...form.register("email")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="block text-[0.75rem] font-semibold tracking-wider text-on-surface-variant uppercase ml-1">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        disabled={isPending}
                        placeholder="••••••••"
                        className="w-full px-4 py-3.5 bg-surface-container-highest border-none rounded-xl focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline-variant"
                        {...form.register("password")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 px-1">
                    <div className="flex gap-1.5 h-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={
                            "flex-1 rounded-full " +
                            (i <= strength.score
                              ? "bg-gradient-to-br from-[#6a37d4] to-[#ae8dff]"
                              : "bg-surface-container-high")
                          }
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[0.75rem] text-on-surface-variant">
                        Security: {strength.label}
                      </span>
                      <span className="text-[0.75rem] text-on-surface-variant">
                        8+ characters
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-4 px-6 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff] text-white font-semibold rounded-xl shadow-[0_8px_32px_rgba(106,55,212,0.08)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>

                <div className="pt-4 text-center">
                  <p className="text-on-surface-variant text-sm">
                    Already have an account?
                    <Link
                      href="/login"
                      className="text-primary font-semibold hover:text-primary-container transition-colors ml-1"
                    >
                      Sign In
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </main>

        <footer className="flex flex-col md:flex-row justify-center items-center gap-6 w-full py-8 mt-auto bg-transparent font-inter leading-relaxed text-sm">
          <div className="text-slate-400 dark:text-slate-500">
            © 2024 Lucid Architecture. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a
              className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100"
              href="#"
            >
              Terms
            </a>
            <a
              className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100"
              href="#"
            >
              Privacy
            </a>
            <a
              className="text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-300 transition-all opacity-80 hover:opacity-100"
              href="#"
            >
              Support
            </a>
          </div>
        </footer>

        <div className="fixed -z-10 top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary-container/5 blur-[120px]"></div>
        <div className="fixed -z-10 bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-container/5 blur-[120px]"></div>
      </div>
    </Layout>
  );
}
