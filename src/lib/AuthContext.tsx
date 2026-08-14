import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (username: string, displayName: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('aether_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const res = await apiRequest('/auth/me');
    if (res.success && res.data?.user) {
      setUser(res.data.user);
    } else {
      localStorage.removeItem('aether_token');
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

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

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    localStorage.removeItem('aether_token');
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
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
