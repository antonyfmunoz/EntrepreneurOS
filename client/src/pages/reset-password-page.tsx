import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import posthog from "posthog-js";

interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

interface ResetPasswordError {
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}

export default function ResetPasswordPage() {
  const [location, setLocation] = useLocation();
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    newPassword: "",
    confirmPassword: ""
  });
  const [errors, setErrors] = useState<ResetPasswordError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    posthog.capture("page_viewed", {
      page: "reset_password"
    });
  }, []);

  const validateForm = (): boolean => {
    const newErrors: ResetPasswordError = {};

    if (!formData.newPassword) {
      newErrors.newPassword = "Password required.";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters.";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Password required.";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match.";
    }

    if (!token) {
      newErrors.general = "Invalid reset link. Request a new one.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 400 && errorData.error?.includes("expired")) {
          setErrors({ general: "Reset link expired. Request a new one." });
          posthog.capture("password_reset_failed", {
            errorCode: "token_expired"
          });
        } else if (response.status === 400) {
          setErrors({ general: "Invalid reset link. Request a new one." });
          posthog.capture("password_reset_failed", {
            errorCode: "token_invalid"
          });
        } else {
          setErrors({ general: "Connection failed. Try again." });
          posthog.capture("password_reset_failed", {
            errorCode: "network_error"
          });
        }
        return;
      }

      posthog.capture("password_reset_completed");
      setIsSuccess(true);
      
      setTimeout(() => {
        setLocation("/sign-in");
      }, 2000);
    } catch (error) {
      setErrors({ general: "Connection failed. Try again." });
      posthog.capture("password_reset_failed", {
        errorCode: "network_error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof ResetPasswordFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-surface border-border-subtle shadow-sm">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle2 className="h-16 w-16 text-success" />
            </div>
            <h2 className="font-mono font-bold text-2xl text-text mb-2">
              Password reset
            </h2>
            <p className="font-mono text-sm text-text-secondary">
              Redirecting to sign in...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-surface border-border-subtle shadow-sm">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="font-mono font-bold text-2xl text-primary">EntrepreneurOS</div>
          </div>
          <CardTitle className="font-mono font-bold text-2xl text-text">
            Set new password
          </CardTitle>
          <CardDescription className="font-mono text-sm text-text-secondary">
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="bg-destructive-muted border border-destructive rounded-md px-4 py-3">
                <p className="font-mono text-sm text-destructive">
                  {errors.general}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label 
                htmlFor="newPassword" 
                className="font-mono text-xs uppercase tracking-wide text-text-secondary"
              >
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={handleInputChange("newPassword")}
                  placeholder="••••••••"
                  className={`font-mono pr-10 ${
                    errors.newPassword 
                      ? "border-destructive focus:ring-destructive focus:border-destructive" 
                      : ""
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="font-mono text-xs text-destructive">
                  {errors.newPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label 
                htmlFor="confirmPassword" 
                className="font-mono text-xs uppercase tracking-wide text-text-secondary"
              >
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleInputChange("confirmPassword")}
                  placeholder="••••••••"
                  className={`font-mono pr-10 ${
                    errors.confirmPassword 
                      ? "border-destructive focus:ring-destructive focus:border-destructive" 
                      : ""
                  }`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="font-mono text-xs text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-hover text-text-on-primary font-mono font-semibold text-sm uppercase tracking-wide"
            >
              {isLoading ? "Resetting..." : "Reset password"}
            </Button>

            <div className="text-center pt-2">
              <Link href="/sign-in" className="font-mono text-sm text-text-secondary hover:text-text transition-colors">Back to sign in</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
