import React, { useState, useEffect } from 'react';
import { Cpu, Lock, Mail, User, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { useBranding } from '../../lib/BrandingContext';

interface RegisterProps {
  onNavigate: (page: string) => void;
}

export const Register: React.FC<RegisterProps> = ({ onNavigate }) => {
  const { register, loginWithGoogle, loginWithDiscord, authConfig } = useAuth();
  const { accentClasses } = useTheme();
  const { pageAnimationsEnabled } = useBranding();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

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

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const res = await register(username, displayName || username, email, password);
    if (res.success) {
      handleRedirect();
    } else {
      setError(res.message || 'Registration failed.');
    }
    setLoading(false);
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

  const animate = pageAnimationsEnabled && !prefersReducedMotion;

  const containerVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 18,
        mass: 0.8
      }
    }
  };

  const motionDivProps = animate ? {
    variants: containerVariants,
    initial: "hidden",
    animate: "visible"
  } : {};

  return (
    <motion.div {...motionDivProps} className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10">
            <Cpu className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
            Create AetherPanel Account
          </h2>
          <p className="text-xs text-zinc-400">
            Get started with $10 free account welcome credit automatically applied.
          </p>
        </div>

        {/* Register Form */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-xl p-8 shadow-2xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Social Sign Up */}
          {hasSocialAuth && (
            <div className="space-y-3">
              {authConfig.googleEnabled && (
                <button
                  type="button"
                  id="btn_google_signup"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || discordLoading || loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 text-xs font-semibold text-zinc-200 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
                >
                  {googleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  )}
                  <span>{googleLoading ? 'Connecting with Google...' : 'Sign Up with Google'}</span>
                </button>
              )}

              {authConfig.discordEnabled && (
                <button
                  type="button"
                  id="btn_discord_signup"
                  onClick={handleDiscordSignIn}
                  disabled={discordLoading || googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/30 hover:bg-[#5865F2]/20 text-xs font-semibold text-[#8ea1e1] hover:text-white transition-all shadow-sm active:scale-[0.99] disabled:opacity-50"
                >
                  {discordLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#5865F2]" />
                  ) : (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 127.14 96.36">
                      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z"/>
                    </svg>
                  )}
                  <span>{discordLoading ? 'Authorizing Discord...' : 'Sign Up with Discord'}</span>
                </button>
              )}
            </div>
          )}

          {hasSocialAuth && isEmailEnabled && (
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-semibold">
                <span className="bg-zinc-900 px-3 text-zinc-500">Or register with email</span>
              </div>
            </div>
          )}

          {isEmailEnabled ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="minecraft_owner"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivers"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading || discordLoading}
                className={`w-full py-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50`}
              >
                <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="text-center text-xs text-zinc-400 py-2">
              Email registration is disabled. Please sign up using one of the available providers above.
            </div>
          )}

          <div className="text-center pt-2 text-xs text-zinc-400">
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="text-amber-400 hover:underline font-semibold"
            >
              Sign In
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
