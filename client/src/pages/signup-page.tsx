import { useState } from 'react';
import { useSignUp, useSignIn } from '@clerk/clerk-react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    plausible?: (event: string, options?: { props: Record<string, string | number> }) => void;
  }
}

interface SignupFormData {
  email: string;
  fullName: string;
  company: string;
  password: string;
  confirmPassword: string;
}

export default function SignupPage() {
  const { toast } = useToast();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    fullName: '',
    company: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.email = 'Enter a valid email address';
    }

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!signUpLoaded || !signUp || !setActiveSignUp) return;

    if (window.plausible) {
      window.plausible('signup_attempted', { props: { method: 'email' } });
    }

    setSubmitting(true);
    try {
      const firstName = formData.fullName.split(' ')[0];
      const lastName = formData.fullName.split(' ').slice(1).join(' ');
      const result = await signUp.create({
        emailAddress: formData.email,
        password: formData.password,
        firstName,
        lastName,
      });
      if (result.status === 'complete') {
        await setActiveSignUp({ session: result.createdSessionId });
        if (window.plausible) {
          window.plausible('signup_succeeded', { props: { userId: 'clerk' } });
        }
        window.location.href = '/portfolios';
      } else {
        toast({
          title: 'Check your email',
          description: 'Please verify your email address to complete registration.',
        });
        setSubmitting(false);
      }
    } catch (err: any) {
      if (window.plausible) {
        window.plausible('signup_failed', { props: { errorCode: 'unknown' } });
      }
      const msg = err?.errors?.[0]?.message || err?.message || 'An unexpected error occurred. Try again.';
      toast({
        title: 'Registration failed',
        description: msg,
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    if (!signInLoaded || !signIn) return;
    if (window.plausible) {
      window.plausible('signup_attempted', { props: { method: 'google' } });
    }
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/portfolios',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to connect. Try again.';
      toast({
        title: 'Google sign-in failed',
        description: msg,
        variant: 'destructive',
      });
      setGoogleLoading(false);
    }
  };

  const handleInputChange = (field: keyof SignupFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f6f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '32px',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(16px)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(106, 55, 212, 0.08)',
        }}
      >
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 600,
              color: '#2c2f30',
              marginBottom: '8px',
              letterSpacing: '-0.02em',
            }}
          >
            Start operating
          </h1>
          <p style={{ fontSize: '1rem', color: '#595c5d', lineHeight: 1.6 }}>
            Create your account to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <Label htmlFor="email" style={{ color: '#2c2f30', fontSize: '0.875rem', fontWeight: 500 }}>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange('email')}
              placeholder="you@company.com"
              disabled={submitting}
              style={{
                marginTop: '6px',
                backgroundColor: fieldErrors.email ? 'rgba(220, 38, 38, 0.05)' : '#eff1f2',
                borderRadius: '12px',
                fontFamily: 'inherit',
              }}
            />
            {fieldErrors.email && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="fullName" style={{ color: '#2c2f30', fontSize: '0.875rem', fontWeight: 500 }}>
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleInputChange('fullName')}
              placeholder="Jane Smith"
              disabled={submitting}
              style={{
                marginTop: '6px',
                backgroundColor: fieldErrors.fullName ? 'rgba(220, 38, 38, 0.05)' : '#eff1f2',
                borderRadius: '12px',
                fontFamily: 'inherit',
              }}
            />
            {fieldErrors.fullName && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="company" style={{ color: '#2c2f30', fontSize: '0.875rem', fontWeight: 500 }}>
              Company (optional)
            </Label>
            <Input
              id="company"
              type="text"
              value={formData.company}
              onChange={handleInputChange('company')}
              placeholder="e.g., Acme Labs"
              disabled={submitting}
              style={{
                marginTop: '6px',
                backgroundColor: '#eff1f2',
                borderRadius: '12px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <Label htmlFor="password" style={{ color: '#2c2f30', fontSize: '0.875rem', fontWeight: 500 }}>
              Password
            </Label>
            <div style={{ position: 'relative', marginTop: '6px' }}>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange('password')}
                placeholder="At least 8 characters"
                disabled={submitting}
                style={{
                  backgroundColor: fieldErrors.password ? 'rgba(220, 38, 38, 0.05)' : '#eff1f2',
                  borderRadius: '12px',
                  paddingRight: '40px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#595c5d',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword" style={{ color: '#2c2f30', fontSize: '0.875rem', fontWeight: 500 }}>
              Confirm password
            </Label>
            <div style={{ position: 'relative', marginTop: '6px' }}>
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                placeholder="Re-enter password"
                disabled={submitting}
                style={{
                  backgroundColor: fieldErrors.confirmPassword ? 'rgba(220, 38, 38, 0.05)' : '#eff1f2',
                  borderRadius: '12px',
                  paddingRight: '40px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#595c5d',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              backgroundColor: '#6a37d4',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '1rem',
              fontWeight: 500,
              marginTop: '8px',
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={18} style={{ marginRight: '8px' }} />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <div style={{ position: 'relative', margin: '8px 0' }}>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(to right, transparent, #abadae, transparent)',
                opacity: 0.2,
              }}
            />
            <span
              style={{
                position: 'relative',
                display: 'inline-block',
                padding: '0 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                color: '#595c5d',
                fontSize: '0.875rem',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              or
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleClick}
            disabled={googleLoading}
            style={{
              width: '100%',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '1rem',
              backgroundColor: '#ffffff',
              color: '#2c2f30',
            }}
          >
            {googleLoading ? (
              <>
                <Loader2 className="animate-spin" size={18} style={{ marginRight: '8px' }} />
                Connecting...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '8px' }}>
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.582c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.29C4.672 5.163 6.656 3.582 9 3.582z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>
        </form>

        <p
          style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#595c5d',
          }}
        >
          Already have an account?{' '}
          <a
            href="/login"
            style={{
              color: '#6a37d4',
              textDecoration: 'none',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Log in
          </a>
        </p>
      </Card>
    </div>
  );
}