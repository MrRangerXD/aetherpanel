import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiRequest } from './api';
import { signInWithGoogleFirebase, FirebaseConfig } from './firebase';

export interface AuthConfig {
  emailPasswordEnabled: boolean;
  googleEnabled: boolean;
  discordEnabled: boolean;
  registrationEnabled: boolean;
  firebaseConfig?: FirebaseConfig;
  discordClientId?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authConfig: AuthConfig;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (username: string, displayName: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  loginWithDiscord: () => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshAuthConfig: () => Promise<void>;
}

const defaultAuthConfig: AuthConfig = {
  emailPasswordEnabled: true,
  googleEnabled: true,
  discordEnabled: true,
  registrationEnabled: true
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authConfig, setAuthConfig] = useState<AuthConfig>(defaultAuthConfig);

  const fetchAuthConfig = useCallback(async () => {
    try {
      const res = await apiRequest('/auth/config');
      if (res.success && res.data) {
        setAuthConfig(res.data);
      }
    } catch (err) {
      console.error('[AuthContext] Failed to load auth provider configuration:', err);
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('aether_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest('/auth/me');
      if (res.success && res.data?.user) {
        setUser(res.data.user);
      } else {
        localStorage.removeItem('aether_token');
        setUser(null);
      }
    } catch {
      localStorage.removeItem('aether_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthConfig();
    fetchCurrentUser();
  }, [fetchAuthConfig, fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res.success && res.data?.token) {
      localStorage.setItem('aether_token', res.data.token);
      setUser(res.data.user);
      return { success: true };
    }

    return {
      success: false,
      message: res.error?.message || 'Login failed.'
    };
  };

  const register = async (username: string, displayName: string, email: string, password: string) => {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, displayName, email, password })
    });

    if (res.success && res.data?.token) {
      localStorage.setItem('aether_token', res.data.token);
      setUser(res.data.user);
      return { success: true };
    }

    return {
      success: false,
      message: res.error?.message || 'Registration failed.'
    };
  };

  // Google Sign-In using Firebase SDK
  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const googleProfile = await signInWithGoogleFirebase(authConfig.firebaseConfig);

      const res = await apiRequest('/auth/firebase-google', {
        method: 'POST',
        body: JSON.stringify({
          email: googleProfile.email,
          displayName: googleProfile.displayName,
          photoUrl: googleProfile.photoUrl,
          googleId: googleProfile.googleId,
          idToken: googleProfile.idToken
        })
      });

      if (res.success && res.data?.token) {
        localStorage.setItem('aether_token', res.data.token);
        setUser(res.data.user);
        return { success: true };
      }

      return {
        success: false,
        message: res.error?.message || 'Failed to authenticate with Google.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Google Sign-In failed.'
      };
    }
  };

  // Discord OAuth Login Flow (Popup postMessage handler)
  const loginWithDiscord = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await apiRequest('/auth/discord/url');
      if (!res.success || !res.data?.url) {
        return {
          success: false,
          message: res.error?.message || 'Discord authentication is currently unavailable or unconfigured.'
        };
      }

      const authUrl = res.data.url;
      const width = 500;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      return new Promise<{ success: boolean; message?: string }>((resolve) => {
        const popup = window.open(
          authUrl,
          'DiscordAuthPopup',
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
        );

        if (!popup) {
          return resolve({
            success: false,
            message: 'Popup blocked by your browser. Please allow popups to sign in with Discord.'
          });
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          const type = event.data?.type;
          if ((type === 'AETHERPANEL_DISCORD_OAUTH_SUCCESS' || type === 'DISCORD_AUTH_SUCCESS') && event.data?.token) {
            window.removeEventListener('message', handleMessage);
            localStorage.setItem('aether_token', event.data.token);
            setUser(event.data.user);
            resolve({ success: true });
          } else if (type === 'AETHERPANEL_DISCORD_OAUTH_ERROR' || type === 'DISCORD_AUTH_ERROR') {
            window.removeEventListener('message', handleMessage);
            resolve({
              success: false,
              message: event.data?.error || 'Discord authentication failed.'
            });
          }
        };

        window.addEventListener('message', handleMessage);

        const checkPopupClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopupClosed);
            window.removeEventListener('message', handleMessage);
            // If user wasn't set, resolve as cancelled
            setTimeout(() => {
              if (!localStorage.getItem('aether_token')) {
                resolve({ success: false, message: 'Discord sign-in window closed.' });
              }
            }, 500);
          }
        }, 500);
      });
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Failed to initiate Discord login.'
      };
    }
  };

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    localStorage.removeItem('aether_token');
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const updateUser = (updated: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...updated } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authConfig,
        login,
        register,
        loginWithGoogle,
        loginWithDiscord,
        logout,
        refreshUser,
        updateUser,
        refreshAuthConfig: fetchAuthConfig
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
