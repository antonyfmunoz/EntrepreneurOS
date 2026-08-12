import { useState } from "react";
import { Link } from "wouter";
import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import posthog from "posthog-js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Email required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Email required.");
      return;
    }

    setIsLoading(true);

    try {
      posthog.capture("reset_email_requested");

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 404) {
          setError("No account with this email. Check your email or create an account.");
        } else {
          setError(data.message || "Connection failed. Try again.");
        }
        return;
      }

      posthog.capture("reset_email_sent");
      setSuccess(true);
    } catch (err) {
      setError("Connection failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-surface border-border-subtle shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="font-mono font-bold text-2xl text-primary">EntrepreneurOS</div>
          </div>
          <CardTitle className="font-mono font-bold text-2xl text-text">
            Reset your password
          </CardTitle>
          <CardDescription className="font-mono text-sm text-text-secondary">
            Enter your email. We'll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-6">
              <Alert className="bg-success-muted border-success">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription className="font-mono text-sm text-text ml-2">
                  Check your email for a reset link.
                </AlertDescription>
              </Alert>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full font-mono font-medium text-sm uppercase tracking-wide"
                >
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono text-xs uppercase tracking-wide text-text-secondary">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    className="pl-10 bg-surface-subtle border-border font-mono text-base text-text placeholder:text-text-tertiary focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  />
                </div>
                {error && (
                  <p className="font-mono text-xs text-destructive mt-1">
                    {error}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide transition-colors duration-150"
              >
                {isLoading ? "Sending..." : "Send reset link"}
              </Button>

              <div className="text-center">
                <Link href="/login" className="font-mono text-sm text-text-secondary hover:text-text transition-colors">Back to sign in</Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
