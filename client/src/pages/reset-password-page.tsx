import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  return (
    <Layout title="ResetPassword">
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-2xl">
                <KeyRound className="w-8 h-8 text-violet-700 dark:text-violet-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              Reset Password
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-center max-w-sm">
              Enter your email address and we'll send you instructions to reset your password
            </p>
          </div>

          <Card className="shadow-[0px_20px_40px_rgba(82,16,188,0.08)] border-0">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Password Recovery</CardTitle>
              <CardDescription className="text-base">
                We'll email you a secure reset link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="architect@example.com"
                      className="pl-11 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-violet-500 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <Alert className="bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800">
                  <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <AlertDescription className="text-violet-800 dark:text-violet-300 text-sm ml-2">
                    Check your spam folder if you don't receive the email within 5 minutes
                  </AlertDescription>
                </Alert>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full h-12 bg-gradient-to-r from-[#5210bc] to-[#6a37d4] hover:opacity-90 text-white font-semibold rounded-xl shadow-[0px_10px_20px_rgba(82,16,188,0.2)] transition-all duration-200"
                  type="submit"
                >
                  Send Reset Link
                </Button>

                <Button
                  variant="ghost"
                  className="w-full h-12 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 font-semibold rounded-xl"
                  asChild
                >
                  <a href="/login" className="flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center space-y-4">
            <div className="flex items-center justify-center gap-6 text-sm">
              <a
                href="/help"
                className="text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                Help Center
              </a>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <a
                href="/contact"
                className="text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                Contact Support
              </a>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-600">
              © 2024 Lucid Architect. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}