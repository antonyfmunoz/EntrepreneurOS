import { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import designTokens from '@/lib/design-tokens';

export default function LoginPage() {
  const { toast } = useToast();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) return;
    if (!isLoaded || !signIn || !setActive) return;

    setAuthError('');
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        window.location.href = '/portfolios';
      } else {
        setAuthError('Sign in not complete — check your email for verification');
        setLoading(false);
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message || err?.message || 'Unable to sign in. Try again.';
      if (msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('password')) {
        setAuthError('Email or password is incorrect');
      } else if (msg.toLowerCase().includes('not found')) {
        setAuthError('No account found with this email');
      } else if (msg.toLowerCase().includes('session already exists') ||
                 msg.toLowerCase().includes('single session mode')) {
        window.location.href = '/portfolios';
        return;
      } else {
        setAuthError(msg);
      }
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isLoaded || !signIn) return;
    setGoogleLoading(true);
    setAuthError('');
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

  const isLoading = loading || googleLoading;

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
          marginTop: '-64px',
        }}
      >
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: designTokens.colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'white', fontSize: '1.25rem', fontWeight: 600 }}>E</span>
            </div>
          </div>
          <h1
            style={{
              fontFamily: designTokens.typography.fontFamily,
              fontSize: '2.25rem',
              fontWeight: 600,
              color: designTokens.colors.onSurface,
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
              {loading ? (
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
              color: designTokens.colors.onSurface,
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
            {googleLoading ? (
              <>
                <Loader2 size={20} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                Connecting...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 20 20" style={{ marginRight: '8px' }}>
                  <path d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z" fill="#4285F4" />
                  <path d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z" fill="#34A853" />
                  <path d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z" fill="#FBBC05" />
                  <path d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z" fill="#EA4335" />
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
        `}
      </style>
    </div>
  );
}
