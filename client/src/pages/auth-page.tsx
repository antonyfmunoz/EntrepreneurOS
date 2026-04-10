import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { queryClient } from "@/lib/queryClient";
import { KeyRound, Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  confirmPassword: z.string(),
  fullName: z.string().optional(),
  company: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const {
    user,
    isLoading,
    loginMutation,
    registerMutation,
    signInWithGoogle,
    resetPassword,
    isClerkReady,
  } = useAuth();
  const { hasCompany, isLoading: companyLoading } = useCompany();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && !isLoading) {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (user && !isLoading && !companyLoading) {
      navigate(hasCompany ? "/home" : "/company-setup");
    }
  }, [user, isLoading, companyLoading, hasCompany, navigate]);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "", fullName: "", company: "" },
  });

  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  function onLoginSubmit(data: LoginFormValues) {
    loginMutation.mutate({ username: data.email, password: data.password });
  }

  function onRegisterSubmit(data: RegisterFormValues) {
    registerMutation.mutate({
      username: data.username,
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      company: data.company,
    });
  }

  async function onResetPasswordSubmit(data: ResetPasswordFormValues) {
    await resetPassword(data.email);
    setShowResetPassword(false);
  }

  if (showResetPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md w-full">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-violet-600" />
              </div>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you instructions to reset your password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...resetForm}>
                <form onSubmit={resetForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                  <FormField
                    control={resetForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    Send Reset Email
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => setShowResetPassword(false)}
              >
                Back to login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const isLoginPending = loginMutation.isPending;
  const isRegisterPending = registerMutation.isPending;

  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 px-6 py-12">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-violet-500 to-indigo-600 bg-clip-text text-transparent">
              EntrepreneurOS
            </h1>
            <p className="text-gray-500 mb-8">
              The Operating System for Founder-Led Companies
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login to your account</CardTitle>
                  <CardDescription>
                    Enter your credentials below to access your workspace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="your@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="link"
                          className="p-0 h-auto text-sm"
                          onClick={() => setShowResetPassword(true)}
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoginPending}>
                        {isLoginPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : "Sign In"}
                      </Button>
                    </form>
                  </Form>

                  {isClerkReady && (
                    <div className="mt-4">
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-gray-500">Or continue with</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={signInWithGoogle}
                      >
                        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>
                        Sign in with Google
                      </Button>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-center">
                  <p className="text-sm text-gray-500">
                    Don't have an account?{" "}
                    <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("register")}>
                      Register now
                    </Button>
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create a new account</CardTitle>
                  <CardDescription>
                    Enter your details to create your workspace
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="yourusername" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="your@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Acme Inc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={isRegisterPending}>
                        {isRegisterPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Account...
                          </>
                        ) : "Create Account"}
                      </Button>
                    </form>
                  </Form>

                  {isClerkReady && (
                    <div className="mt-4">
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white px-2 text-gray-500">Or continue with</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                        onClick={signInWithGoogle}
                      >
                        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>
                        Sign up with Google
                      </Button>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-center">
                  <p className="text-sm text-gray-500">
                    Already have an account?{" "}
                    <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("login")}>
                      Login instead
                    </Button>
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#6a37d4] to-[#ae8dff]">
        <div className="flex flex-col justify-center items-center h-full p-12 text-white">
          <h2 className="text-4xl font-bold mb-6">
            The Operating System for Founder-Led Companies
          </h2>
          <div className="max-w-xl space-y-6">
            <p className="text-xl">
              Structure, strategy, and execution in one intelligent interface.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center">
                <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Design your org chart and operating structure
              </li>
              <li className="flex items-center">
                <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Delegate work to your team and to DEX
              </li>
              <li className="flex items-center">
                <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Turn decisions into repeatable workflows
              </li>
              <li className="flex items-center">
                <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Run multiple companies from one portfolio
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
