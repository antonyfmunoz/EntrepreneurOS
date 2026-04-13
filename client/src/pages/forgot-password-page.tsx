import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

const BrandLogo: React.FC = () => (
  <div className="flex items-center justify-center mb-12">
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: '#6a37d4' }}
      >
        <span className="text-white text-xl font-semibold">E</span>
      </div>
      <span className="text-2xl font-semibold" style={{ color: '#2c2f30' }}>
        EntrepreneurOS
      </span>
    </div>
  </div>
);

const BackToLoginLink: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <button
      onClick={() => setLocation('/login')}
      className="inline-flex items-center gap-2 text-sm transition-colors hover:opacity-70"
      style={{ color: '#6a37d4' }}
    >
      <ArrowLeft className="w-4 h-4" />
      Back to login
    </button>
  );
};

const SuccessMessage: React.FC<{ email: string }> = ({ email }) => (
  <div className="flex flex-col items-center text-center">
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
      style={{ backgroundColor: 'rgba(106, 55, 212, 0.1)' }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: '#6a37d4' }}
      >
        <Check className="w-6 h-6 text-white" />
      </div>
    </div>

    <h2 className="text-2xl font-semibold mb-3" style={{ color: '#2c2f30' }}>
      Check your email
    </h2>

    <p className="text-base mb-6" style={{ color: '#595c5d', lineHeight: '1.6' }}>
      We sent a password reset code to <span className="font-medium" style={{ color: '#2c2f30' }}>{email}</span>
    </p>

    <p className="text-sm mb-8" style={{ color: '#595c5d', lineHeight: '1.6' }}>
      Check your inbox for the reset code. If you don't see it, check your spam folder.
    </p>

    <BackToLoginLink />
  </div>
);

const ForgotPasswordForm: React.FC<{ onSuccess: (email: string) => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const { toast } = useToast();
  const { resetPassword } = useAuth();

  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError('Email required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Enter a valid email address');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword(email);
      onSuccess(email);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send reset email. Try again.';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="mb-6">
        <Label
          htmlFor="email"
          className="block text-sm font-medium mb-2"
          style={{ color: '#2c2f30' }}
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError('');
          }}
          onBlur={() => email && validateEmail(email)}
          disabled={isSubmitting}
          className="w-full transition-colors"
          style={{
            backgroundColor: emailError ? 'rgba(220, 38, 38, 0.05)' : '#f5f6f7',
            color: '#2c2f30',
          }}
          aria-label="Email address"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
        />
        {emailError && (
          <p
            id="email-error"
            className="text-sm mt-2"
            style={{ color: '#dc2626' }}
            role="alert"
          >
            {emailError}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full text-base font-medium transition-colors"
        style={{
          backgroundColor: '#6a37d4',
          color: '#ffffff',
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? 'Sending...' : 'Send reset code'}
      </Button>

      <div className="mt-6 text-center">
        <BackToLoginLink />
      </div>
    </form>
  );
};

export default function ForgotPasswordPage() {
  const [resetEmail, setResetEmail] = useState<string | null>(null);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 sm:p-12"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(106, 55, 212, 0.08)',
        }}
      >
        <BrandLogo />

        {resetEmail ? (
          <SuccessMessage email={resetEmail} />
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold mb-3" style={{ color: '#2c2f30' }}>
                Reset your password
              </h1>
              <p className="text-base" style={{ color: '#595c5d', lineHeight: '1.6' }}>
                Enter your email and we'll send you a code to reset your password.
              </p>
            </div>

            <ForgotPasswordForm onSuccess={setResetEmail} />
          </>
        )}
      </div>
    </div>
  );
}
