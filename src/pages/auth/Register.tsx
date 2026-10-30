import React, { useState } from 'react';
import { Lock, Mail, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useBranding } from '../../lib/BrandingContext';

interface RegisterProps {
  onNavigate: (page: string) => void;
}

export const Register: React.FC<RegisterProps> = ({ onNavigate }) => {
  const { register, loginWithGoogle, loginWithDiscord, authConfig } = useAuth();
  const { brandName } = useBranding();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);

  const handleRedirect = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get('redirect');
    if (redirectUrl) {
      window.history.pushState({}, '', redirectUrl);
      window.dispatchEvent(new Event('popstate'));
    } else {
      onNavigate('dashboard');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName.trim() || cleanUsername;

    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const res = await register(cleanUsername, cleanDisplayName, cleanEmail, password);
    if (res.success) {
      handleRedirect();
    } else {
      setError(res.message || 'Registration failed.');
    }
    setLoading(false);
  };

  const handleResetRateLimits = async () => {
    try {
      await fetch('/api/v1/auth/clear-rate-limits', { method: 'POST' });
      setError(null);
    } catch {}
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        handleRedirect();
      } else {
        setError(res.message || 'Google registration failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Google registration failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDiscordSignIn = async () => {
    setError(null);
    setDiscordLoading(true);
    try {
      const res = await loginWithDiscord();
      if (res.success) {
        handleRedirect();
      } else {
        setError(res.message || 'Discord registration failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Discord registration failed.');
    } finally {
      setDiscordLoading(false);
    }
  };

  const hasSocialAuth = authConfig.googleEnabled || authConfig.discordEnabled;
  const isEmailEnabled = authConfig.emailPasswordEnabled;

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-sm space-y-5">
        
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="label">
            REGISTRATION
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)] font-mono">
            Create Account
          </h1>
          <p className="text-xs text-[var(--color-ink-mute)]">
            Deploy servers and manage cloud resources on {brandName || 'AetherPanel'}.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 text-xs text-[var(--color-err)] flex flex-col gap-1.5" role="alert">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {(error.toLowerCase().includes('too many') || error.toLowerCase().includes('rate limit')) && (
                <div className="pt-1 flex items-center justify-between border-t border-[var(--color-err)]/20">
                  <span className="text-[10px] text-[var(--color-ink-mute)]">Rate limit triggered?</span>
                  <button
                    type="button"
                    onClick={handleResetRateLimits}
                    className="text-[10px] font-mono text-[var(--color-err)] hover:underline"
                  >
                    Reset Limits
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Social Sign Up */}
          {hasSocialAuth && (
            <div className="space-y-2">
              {authConfig.googleEnabled && (
                <button
                  type="button"
                  id="btn_google_signup"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || discordLoading || loading}
                  className="w-full flex items-center justify-center gap-2.5 px-3 h-9 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] hover:bg-[var(--color-surface-3)] text-xs font-medium text-[var(--color-ink)] transition-colors active:scale-[0.985] disabled:opacity-50 cursor-pointer"
                >
                  {googleLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-ink-mute)]" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  <span>{googleLoading ? 'Connecting...' : 'Google'}</span>
                </button>
              )}

              {authConfig.discordEnabled && (
                <button
                  type="button"
                  id="btn_discord_signup"
                  onClick={handleDiscordSignIn}
                  disabled={discordLoading || googleLoading || loading}
                  className="w-full flex items-center justify-center gap-2.5 px-3 h-9 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] hover:bg-[var(--color-surface-3)] text-xs font-medium text-[var(--color-ink)] transition-colors active:scale-[0.985] disabled:opacity-50 cursor-pointer"
                >
                  {discordLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-ink-mute)]" />
                  ) : (
                    <svg className="w-3.5 h-3.5 fill-current text-[var(--color-accent)]" viewBox="0 0 127.14 96.36">
                      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z"/>
                    </svg>
                  )}
                  <span>{discordLoading ? 'Connecting...' : 'Discord'}</span>
                </button>
              )}
            </div>
          )}

          {hasSocialAuth && isEmailEnabled && (
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-line)]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono">
                <span className="bg-[var(--color-surface)] px-2 text-[var(--color-ink-mute)]">or email</span>
              </div>
            </div>
          )}

          {isEmailEnabled ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label block mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="user_name"
                    aria-invalid={Boolean(error && error.toLowerCase().includes('username'))}
                    className="field w-full pl-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label block mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="field w-full text-xs"
                />
              </div>

              <div>
                <label className="label block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@domain.com"
                    aria-invalid={Boolean(error && error.toLowerCase().includes('email'))}
                    className="field w-full pl-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-invalid={Boolean(error && error.toLowerCase().includes('password'))}
                    className="field w-full pl-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="label block mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-invalid={Boolean(error && error.toLowerCase().includes('match'))}
                  className="field w-full text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading || discordLoading}
                className="btn btn-primary w-full h-9 mt-1 text-xs"
              >
                <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <div className="text-center text-xs text-[var(--color-ink-mute)] py-2">
              Email registration disabled.
            </div>
          )}

          <div className="text-center pt-2 text-xs text-[var(--color-ink-mute)] border-t border-[var(--color-line)]">
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="text-[var(--color-accent)] hover:underline font-medium cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
