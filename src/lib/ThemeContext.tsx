import React, { createContext, useContext, useState, useEffect } from 'react';

export type AccentColor = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose';
export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  accent: AccentColor;
  setTheme: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  customCursorEnabled: boolean;
  setCustomCursorEnabled: (enabled: boolean) => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;
  adsEnabled: boolean;
  setAdsEnabled: (enabled: boolean) => void;
  accentClasses: {
    text: string;
    bg: string;
    border: string;
    ring: string;
    gradient: string;
    shadow: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('aether_theme') as ThemeMode) || 'dark';
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem('aether_accent') as AccentColor) || 'amber';
  });

  const [customCursorEnabled, setCustomCursorState] = useState<boolean>(() => {
    const val = localStorage.getItem('aether_custom_cursor');
    return val !== null ? val === 'true' : true;
  });

  const [animationsEnabled, setAnimationsState] = useState<boolean>(() => {
    const val = localStorage.getItem('aether_animations');
    return val !== null ? val === 'true' : true;
  });

  const [adsEnabled, setAdsState] = useState<boolean>(() => {
    const val = localStorage.getItem('aether_ads_enabled');
    return val !== null ? val === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('aether_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('aether_accent', accent);
  }, [accent]);

  useEffect(() => {
    localStorage.setItem('aether_custom_cursor', String(customCursorEnabled));
  }, [customCursorEnabled]);

  useEffect(() => {
    localStorage.setItem('aether_animations', String(animationsEnabled));
  }, [animationsEnabled]);

  useEffect(() => {
    localStorage.setItem('aether_ads_enabled', String(adsEnabled));
  }, [adsEnabled]);

  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const setAccent = (acc: AccentColor) => setAccentState(acc);
  const setCustomCursorEnabled = (enabled: boolean) => setCustomCursorState(enabled);
  const setAnimationsEnabled = (enabled: boolean) => setAnimationsState(enabled);
  const setAdsEnabled = (enabled: boolean) => setAdsState(enabled);

  const getAccentClasses = (): ThemeContextType['accentClasses'] => {
    switch (accent) {
      case 'cyan':
        return {
          text: 'text-cyan-400',
          bg: 'bg-cyan-500',
          border: 'border-cyan-500/30',
          ring: 'focus:ring-cyan-500/50',
          gradient: 'from-cyan-500 to-blue-600',
          shadow: 'shadow-cyan-500/20'
        };
      case 'emerald':
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500',
          border: 'border-emerald-500/30',
          ring: 'focus:ring-emerald-500/50',
          gradient: 'from-emerald-500 to-teal-600',
          shadow: 'shadow-emerald-500/20'
        };
      case 'amber':
      default:
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500',
          border: 'border-amber-500/30',
          ring: 'focus:ring-amber-500/50',
          gradient: 'from-amber-500 via-yellow-500 to-amber-600',
          shadow: 'shadow-amber-500/20'
        };
      case 'rose':
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500',
          border: 'border-rose-500/30',
          ring: 'focus:ring-rose-500/50',
          gradient: 'from-rose-500 to-pink-600',
          shadow: 'shadow-rose-500/20'
        };
      case 'violet':
        return {
          text: 'text-purple-400',
          bg: 'bg-purple-600',
          border: 'border-purple-500/30',
          ring: 'focus:ring-purple-500/50',
          gradient: 'from-purple-600 to-indigo-600',
          shadow: 'shadow-purple-500/20'
        };
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      accent,
      setTheme,
      setAccent,
      customCursorEnabled,
      setCustomCursorEnabled,
      animationsEnabled,
      setAnimationsEnabled,
      adsEnabled,
      setAdsEnabled,
      accentClasses: getAccentClasses()
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
