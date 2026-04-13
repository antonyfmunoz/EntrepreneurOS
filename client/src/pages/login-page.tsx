import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import designTokens from '@/lib/design-tokens';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  userId: string;
  token: string;
}

interface LoginError {
  code: string;
  message: string;
}

const loginWithEmail = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
};

const loginWithGoogle = async (): Promise<LoginResponse> => {
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
};

const trackEvent = (name: string, properties: Record<string, unknown>) => {
  console.log(`[Analytics] ${name}`, properties);
};

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');

  const emailMutation = useMutation({
    mutationFn: loginWithEmail,
    onMutate: () => {
      trackEvent('login_attempted', { method: 'email' });
      setAuthError('');
      setEmailError('');
      setPasswordError('');
    },
    onSuccess: (data) => {
      trackEvent('login_succeeded', { method: 'email', userId: data.userId });
      localStorage.setItem('auth_token', data.token);
      setLocation('/portfolio');
    },
    onError: (error: LoginError) => {
      trackEvent('login_failed', { method: 'email', errorCode: error.code });
      
      if (error.code === 'INVALID_EMAIL') {
        setEmailError('Email is not valid');
      } else if (error.code === 'INVALID_CREDENTIALS') {
        setAuthError('Email or password is incorrect');
      } else if (error.code === 'USER_NOT_FOUND') {
        setAuthError('No account found with this email');
      } else {
        toast({
          title: 'Login failed',
          description: error.message || 'Unable to sign in. Try again.',
          variant: 'destructive',
        });
      }
    },
  });

  const googleMutation = useMutation({
    mutationFn: loginWithGoogle,
    onMutate: () => {
      trackEvent('oauth_initiated', {});
      trackEvent('login_attempted', { method: 'google' });
      setAuthError('');
    },
    onSuccess: (data) => {
      trackEvent('login_succeeded', { method: 'google', userId: data.userId });
      localStorage.setItem('auth_token', data.token);
      setLocation('/portfolio');
    },
    onError: (error: LoginError) => {
      trackEvent('login_failed', { method: 'google', errorCode: error.code });
      toast({
        title: 'Google sign-in failed',
        description: error.message || 'Unable to connect. Try again.',
        variant: 'destructive',
      });
    },
  });

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (value.length === 0) {
      setPasswordError('Password is required');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    emailMutation.mutate({ email, password });
  };

  const handleGoogleLogin = () => {
    googleMutation.mutate();
  };

  const isLoading = emailMutation.isPending || googleMutation.isPending;

  return (
    <div 
      style={{ 
        backgroundColor: designTokens.colors.surface,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '448px',
          marginLeft: 'auto',
          marginRight: '0',
          marginTop: '-64px',
        }}
      >
        <div style={{ marginBottom: '48px' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="48" height="48" rx="12" fill={designTokens.colors.primary} />
            <path
              d="M24 12L32 20L24 28M24 28L16 20L24 12"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 28L24 36L32 28"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h1
            style={{
              fontFamily: designTokens.typography.fontFamily,
              fontSize: '2.25rem',
              fontWeight: 600,
              color: designTokens.colors.onSurface,
              marginTop: '24px',
              marginBottom: '8px',
              letterSpacing: '-0.02em',
            }}
          >
            Sign in
          </h1>
          <p
            style={{
              fontFamily: designTokens.typography.fontFamily,
              fontSize: '1rem',
              color: designTokens.colors.onSurfaceVariant,
              lineHeight: 1.6,
            }}
          >
            Access your portfolio and companies
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(16px)',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 8px 32px rgba(106, 55, 212, 0.08)',
          }}
        >
          {authError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#fee',
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            >
              <AlertCircle size={20} color="#c00" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p
                style={{
                  fontFamily: designTokens.typography.fontFamily,
                  fontSize: '0.875rem',
                  color: '#c00',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {authError}
              </p>
            </div>
          )}

          <form onSubmit={handleEmailLogin}>
            <div style={{ marginBottom: '24px' }}>
              <Label
                htmlFor="email"
                style={{
                  fontFamily: designTokens.typography.fontFamily,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: designTokens.colors.onSurface,
                  marginBottom: '8px',
                  display: 'block',
                }}
              >
                Email
              </Label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={20}
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: designTokens.colors.onSurfaceVariant,
                    pointerEvents: 'none',
                  }}
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  placeholder="you@company.com"
                  disabled={isLoading}
                  style={{
                    paddingLeft: '48px',
                    backgroundColor: emailError ? '#fee' : designTokens.colors.surfaceContainerLow,
                    fontFamily: designTokens.typography.fontFamily,
                    fontSize: '1rem',
                    color: designTokens.colors.onSurface,
                  }}
                />
              </div>
              {emailError && (
                <p
                  style={{
                    fontFamily: designTokens.typography.fontFamily,
                    fontSize: '0.75rem',
                    color: '#c00',
                    marginTop: '8px',
                    marginBottom: 0,
                  }}
                >
                  {emailError}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <Label
                htmlFor="password"
                style={{
                  fontFamily: designTokens.typography.fontFamily,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: designTokens.colors.onSurface,
                  marginBottom: '8px',
                  display: 'block',
                }}
              >
                Password
              </Label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={20}
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: designTokens.colors.onSurfaceVariant,
                    pointerEvents: 'none',
                  }}
                />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={(e) => validatePassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  style={{
                    paddingLeft: '48px',
                    backgroundColor: passwordError ? '#fee' : designTokens.colors.surfaceContainerLow,
                    fontFamily: designTokens.typography.fontFamily,
                    fontSize: '1rem',
                    color: designTokens.colors.onSurface,
                  }}
                />
              </div>
              {passwordError && (
                <p
                  style={{
                    fontFamily: designTokens.typography.fontFamily,
                    fontSize: '0.75rem',
                    color: '#c00',
                    marginTop: '8px',
                    marginBottom: 0,
                  }}
                >
                  {passwordError}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <a
                href="/forgot-password"
                style={{
                  fontFamily: designTokens.typography.fontFamily,
                  fontSize: '0.875rem',
                  color: designTokens.colors.primary,
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                backgroundColor: designTokens.colors.primary,
                color: 'white',
                fontFamily: designTokens.typography.fontFamily,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '12px',
                padding: '12px 24px',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {emailMutation.isPending ? (
                <>
                  <Loader2 size={20} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '32px',
              marginBottom: '32px',
            }}
          >
            <div style={{ flex: 1, height: '1px', backgroundColor: designTokens.colors.surfaceContainerLow }} />
            <span
              style={{
                fontFamily: designTokens.typography.fontFamily,
                fontSize: '0.875rem',
                color: designTokens.colors.onSurfaceVariant,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              or
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: designTokens.colors.surfaceContainerLow }} />
          </div>

          <Button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              backgroundColor: designTokens.colors.surfaceContainerLow,
              color: designTokens.colors.primary,
              fontFamily: designTokens.typography.fontFamily,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: '12px',
              padding: '12px 24px',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {googleMutation.isPending ? (
              <>
                <Loader2 size={20} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                Connecting...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" style={{ marginRight: '8px' }}>
                  <path
                    d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z"
                    fill="#4285F4"
                  />
                  <path
                    d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <p
            style={{
              fontFamily: designTokens.typography.fontFamily,
              fontSize: '0.875rem',
              color: designTokens.colors.onSurfaceVariant,
              textAlign: 'center',
              marginTop: '32px',
              marginBottom: 0,
            }}
          >
            Don't have an account?{' '}
            <a
              href="/signup"
              style={{
                color: designTokens.colors.primary,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Create one
            </a>
          </p>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @media (max-width: 768px) {
            body {
              padding: 16px;
            }
          }
        `}
      </style>
    </div>
  );
}