import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SUCCESS_MESSAGE_DURATION = 2000;

interface BrandLogoProps {
  className?: string;
}

function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-[#6a37d4] flex items-center justify-center">
        <span className="text-white font-semibold text-sm">E</span>
      </div>
      <span className="text-[#2c2f30] font-semibold text-lg">EntrepreneurOS</span>
    </div>
  );
}

interface BackToLoginLinkProps {
  className?: string;
}

function BackToLoginLink({ className = '' }: BackToLoginLinkProps) {
  const [, setLocation] = useLocation();

  return (
    <button
      onClick={() => setLocation('/login')}
      className={`flex items-center gap-2 text-[#595c5d] hover:text-[#2c2f30] transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-sm">Back to login</span>
    </button>
  );
}

interface SuccessMessageProps {
  onComplete?: () => void;
}

function SuccessMessage({ onComplete }: SuccessMessageProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, SUCCESS_MESSAGE_DURATION);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-[#ae8dff]/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-[#6a37d4]" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-[#2c2f30]">Password reset</h2>
        <p className="text-[#595c5d]">Your password has been updated. Redirecting to login...</p>
      </div>
    </div>
  );
}

interface ResetPasswordFormProps {
  token: string;
  onSuccess: () => void;
}

interface PasswordFormData {
  newPassword: string;
  confirmPassword: string;
}

interface ValidationErrors {
  newPassword?: string;
  confirmPassword?: string;
}

function ResetPasswordForm({ token, onSuccess }: ResetPasswordFormProps) {
  const [formData, setFormData] = useState<PasswordFormData>({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Password reset failed');
      }

      return response.json();
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (formData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    }

    if (formData.confirmPassword !== formData.newPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    resetPasswordMutation.mutate({
      token,
      newPassword: formData.newPassword,
    });
  };

  const handleInputChange = (field: keyof PasswordFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors(prev => ({ ...prev, [field]: undefined }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-sm font-medium text-[#2c2f30]">
            New password
          </Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={e => handleInputChange('newPassword', e.target.value)}
              className="pr-10"
              placeholder="Enter new password"
              disabled={resetPasswordMutation.isPending}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#595c5d] hover:text-[#2c2f30]"
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {validationErrors.newPassword && (
            <p className="text-sm text-red-600">{validationErrors.newPassword}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#2c2f30]">
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={e => handleInputChange('confirmPassword', e.target.value)}
              className="pr-10"
              placeholder="Confirm new password"
              disabled={resetPasswordMutation.isPending}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#595c5d] hover:text-[#2c2f30]"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {validationErrors.confirmPassword && (
            <p className="text-sm text-red-600">{validationErrors.confirmPassword}</p>
          )}
        </div>
      </div>

      {resetPasswordMutation.isError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">
            {resetPasswordMutation.error instanceof Error
              ? resetPasswordMutation.error.message
              : 'Password reset failed'}
          </p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-[#6a37d4] hover:bg-[#5a2dc0] text-white"
        disabled={resetPasswordMutation.isPending}
      >
        {resetPasswordMutation.isPending ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Resetting password...</span>
          </div>
        ) : (
          'Reset password'
        )}
      </Button>
    </form>
  );
}

interface TokenValidationState {
  isValidating: boolean;
  isValid: boolean;
  error?: string;
}

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [tokenState, setTokenState] = useState<TokenValidationState>({
    isValidating: true,
    isValid: false,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');

    if (!tokenParam) {
      setTokenState({
        isValidating: false,
        isValid: false,
        error: 'No reset token found in URL',
      });
      return;
    }

    setToken(tokenParam);
    setTokenState({
      isValidating: false,
      isValid: true,
    });
  }, []);

  const handleSuccess = () => {
    setShowSuccess(true);
  };

  const handleSuccessComplete = () => {
    setLocation('/login');
  };

  if (tokenState.isValidating) {
    return (
      <div className="min-h-screen bg-[#f5f6f7] flex items-center justify-center p-4 sm:p-6 font-inter">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl p-6 sm:p-12 shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
            <div className="space-y-6">
              <div className="h-8 w-48 bg-[#eff1f2] rounded animate-pulse" />
              <div className="space-y-4">
                <div className="h-12 bg-[#eff1f2] rounded animate-pulse" />
                <div className="h-12 bg-[#eff1f2] rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenState.isValid) {
    return (
      <div className="min-h-screen bg-[#f5f6f7] flex items-center justify-center p-4 sm:p-6 font-inter">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <BrandLogo />
          </div>

          <div className="bg-white rounded-xl p-6 sm:p-12 shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
            <div className="text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-[#2c2f30]">Invalid reset link</h1>
                <p className="text-[#595c5d]">
                  {tokenState.error || 'This password reset link is invalid or has expired.'}
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setLocation('/forgot-password')}
                  className="w-full bg-[#6a37d4] hover:bg-[#5a2dc0] text-white"
                >
                  Request new reset link
                </Button>
                <BackToLoginLink className="justify-center" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f7] flex items-center justify-center p-4 sm:p-6 font-inter">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        <div className="bg-white rounded-xl p-6 sm:p-12 shadow-[0_8px_32px_rgba(106,55,212,0.08)]">
          {showSuccess ? (
            <SuccessMessage onComplete={handleSuccessComplete} />
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-[#2c2f30]">Set new password</h1>
                <p className="text-[#595c5d]">
                  Enter your new password below. Must be at least 8 characters.
                </p>
              </div>

              <ResetPasswordForm token={token!} onSuccess={handleSuccess} />

              <div className="pt-4 border-t border-[#eff1f2]">
                <BackToLoginLink className="justify-center" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}