import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { THEME_PRESETS, FONT_OPTIONS, ThemePreset, FontOption } from './theme';
import { CustomThemeSettings } from '../types';
import { apiRequest } from './api';

export type AccentColor = 'amber' | 'emerald' | 'cyan' | 'violet' | 'rose' | 'blue';
export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  activeThemeId: string;
  activePreset: ThemePreset;
  activeFontId: string;
  activeFont: FontOption;
  accent: AccentColor;
  customCursorEnabled: boolean;
  animationsEnabled: boolean;
  adsEnabled: boolean;
  allowUserCustomization: boolean;
  backgroundBlur: string;
  backgroundOverlayOpacity: number;
  themeAssets: {
    logoUrl?: string;
    faviconUrl?: string;
    bgPatternUrl?: string;
    bannerUrl?: string;
    loginBgUrl?: string;
  };
  setTheme: (mode: ThemeMode) => void;
  setActiveThemeId: (themeId: string) => void;
  setActiveFontId: (fontId: string) => void;
  setAccent: (accent: AccentColor) => void;
  setCustomCursorEnabled: (enabled: boolean) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setAdsEnabled: (enabled: boolean) => void;
  setBackgroundBlur: (blur: string) => void;
  setBackgroundOverlayOpacity: (opacity: number) => void;
  setThemeAssets: (assets: Partial<ThemeContextType['themeAssets']>) => void;
  applySystemThemeSettings: (settings: CustomThemeSettings) => void;
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

  const [activeThemeId, setActiveThemeIdState] = useState<string>(() => {
    return localStorage.getItem('aether_active_theme_id') || 'golden';
  });

  const [activeFontId, setActiveFontIdState] = useState<string>(() => {
    return localStorage.getItem('aether_active_font_id') || 'Plus Jakarta Sans';
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem('aether_accent') as AccentColor) || 'amber';
  });

  const [themeAssets, setThemeAssetsState] = useState<ThemeContextType['themeAssets']>(() => {
    try {
      const saved = localStorage.getItem('aether_theme_assets');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
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

  const [allowUserCustomization, setAllowUserCustomization] = useState<boolean>(true);
  const [backgroundBlur, setBackgroundBlurState] = useState<string>(() => {
    return localStorage.getItem('aether_background_blur') || 'none';
  });
  const [backgroundOverlayOpacity, setBackgroundOverlayOpacityState] = useState<number>(() => {
    const val = localStorage.getItem('aether_background_overlay_opacity');
    return val !== null ? parseInt(val) : 75;
  });

  // Load system theme settings on initial boot from public endpoint
  useEffect(() => {
    const fetchSystemTheme = async () => {
      try {
        const res = await apiRequest('/public/theme-settings');
        if (res.success && res.data) {
          const sys = res.data as CustomThemeSettings;
          setAllowUserCustomization(sys.allowUserCustomization);
          
          if (sys.backgroundBlur) {
            setBackgroundBlurState(sys.backgroundBlur);
          }
          if (sys.backgroundOverlayOpacity !== undefined) {
            setBackgroundOverlayOpacityState(sys.backgroundOverlayOpacity);
          }

          if (!sys.allowUserCustomization) {
            // Force authoritative values from system settings, discarding client overrides
            if (sys.activeThemeId) setActiveThemeIdState(sys.activeThemeId);
            if (sys.activeFontId) setActiveFontIdState(sys.activeFontId);
            if (sys.assets) setThemeAssetsState(sys.assets);
          } else {
            // Load custom settings from localStorage if user overrides exist
            const localTheme = localStorage.getItem('aether_active_theme_id');
            const localFont = localStorage.getItem('aether_active_font_id');
            const localAssetsStr = localStorage.getItem('aether_theme_assets');
            const localBlur = localStorage.getItem('aether_background_blur');
            const localOpacity = localStorage.getItem('aether_background_overlay_opacity');

            if (localTheme) setActiveThemeIdState(localTheme);
            else if (sys.activeThemeId) setActiveThemeIdState(sys.activeThemeId);

            if (localFont) setActiveFontIdState(localFont);
            else if (sys.activeFontId) setActiveFontIdState(sys.activeFontId);

            if (localBlur) setBackgroundBlurState(localBlur);
            if (localOpacity) setBackgroundOverlayOpacityState(parseInt(localOpacity));

            if (localAssetsStr) {
              try {
                setThemeAssetsState(JSON.parse(localAssetsStr));
              } catch {
                if (sys.assets) setThemeAssetsState(sys.assets);
              }
            } else if (sys.assets) {
              setThemeAssetsState(sys.assets);
            }
          }
        }
      } catch {
        // Fall back gracefully to localStorage
      }
    };
    fetchSystemTheme();
  }, []);

  const activePreset = THEME_PRESETS.find(p => p.id === activeThemeId) || THEME_PRESETS[0];
  const activeFont = FONT_OPTIONS.find(f => f.id === activeFontId) || FONT_OPTIONS[0];

  // Apply Theme Mode class
  useEffect(() => {
    localStorage.setItem('aether_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Apply Theme CSS Variables & Colors
  useEffect(() => {
    localStorage.setItem('aether_active_theme_id', activeThemeId);
    const root = document.documentElement;

    root.style.setProperty('--color-accent', activePreset.accent);
    root.style.setProperty('--color-accent-hover', activePreset.accentHover);
    root.style.setProperty('--color-accent-glow', activePreset.glowColor);
    root.style.setProperty('--color-accent-border', activePreset.borderColor);
    root.style.setProperty('--color-badge-bg', activePreset.badgeBg);
    root.style.setProperty('--color-badge-text', activePreset.badgeText);

    // Map accent for legacy components
    if (activeThemeId === 'golden') setAccentState('amber');
    else if (activeThemeId === 'emerald') setAccentState('emerald');
    else if (activeThemeId === 'midnight') setAccentState('cyan');
    else if (activeThemeId === 'cyberpunk') setAccentState('violet');
    else if (activeThemeId === 'crimson') setAccentState('rose');
    else if (activeThemeId === 'sapphire') setAccentState('blue');
  }, [activeThemeId, activePreset]);

  // Apply Font Family
  useEffect(() => {
    localStorage.setItem('aether_active_font_id', activeFontId);
    document.body.style.fontFamily = activeFont.fontFamily;
  }, [activeFontId, activeFont]);

  // Apply Favicon & Background Asset (Image / animated GIF, Blur control, Overlay opacity)
  useEffect(() => {
    localStorage.setItem('aether_theme_assets', JSON.stringify(themeAssets));

    if (themeAssets.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = themeAssets.faviconUrl;
    }

    // Dynamic wallpaper, blur, and opacity styling tag
    let styleTag = document.getElementById('aether-custom-bg-styles') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'aether-custom-bg-styles';
      document.head.appendChild(styleTag);
    }

    const blurVal = backgroundBlur === 'none' ? '0px' : backgroundBlur;
    const bgUrl = themeAssets.bgPatternUrl || '';
    const opacityVal = backgroundOverlayOpacity / 100;

    styleTag.innerHTML = `
      body {
        background-color: #09090b !important;
      }
      body::before {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: -20;
        background-image: ${bgUrl ? `url('${bgUrl}')` : 'none'};
        background-size: cover;
        background-attachment: fixed;
        background-position: center;
        pointer-events: none;
      }
      body::after {
        content: "";
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: -10;
        background-color: rgba(9, 9, 11, ${opacityVal}) !important;
        backdrop-filter: blur(${blurVal}) !important;
        -webkit-backdrop-filter: blur(${blurVal}) !important;
        pointer-events: none;
      }
    `;
  }, [themeAssets, backgroundBlur, backgroundOverlayOpacity]);

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
  
  const setActiveThemeId = (id: string) => {
    if (!allowUserCustomization) return;
    setActiveThemeIdState(id);
  };
  
  const setActiveFontId = (id: string) => {
    if (!allowUserCustomization) return;
    setActiveFontIdState(id);
  };
  
  const setAccent = (acc: AccentColor) => setAccentState(acc);
  const setCustomCursorEnabled = (enabled: boolean) => setCustomCursorState(enabled);
  const setAnimationsEnabled = (enabled: boolean) => setAnimationsState(enabled);
  const setAdsEnabled = (enabled: boolean) => setAdsState(enabled);

  const setBackgroundBlur = (blur: string) => {
    if (!allowUserCustomization) return;
    setBackgroundBlurState(blur);
    localStorage.setItem('aether_background_blur', blur);
  };

  const setBackgroundOverlayOpacity = (opacity: number) => {
    if (!allowUserCustomization) return;
    setBackgroundOverlayOpacityState(opacity);
    localStorage.setItem('aether_background_overlay_opacity', String(opacity));
  };

  const setThemeAssets = (assets: Partial<ThemeContextType['themeAssets']>) => {
    if (!allowUserCustomization) return;
    setThemeAssetsState(prev => ({ ...prev, ...assets }));
  };

  const applySystemThemeSettings = (settings: CustomThemeSettings) => {
    // Admins can apply system theme settings globally
    if (settings.activeThemeId) setActiveThemeIdState(settings.activeThemeId);
    if (settings.activeFontId) setActiveFontIdState(settings.activeFontId);
    if (settings.backgroundBlur) setBackgroundBlurState(settings.backgroundBlur);
    if (settings.backgroundOverlayOpacity !== undefined) setBackgroundOverlayOpacityState(settings.backgroundOverlayOpacity);
    if (settings.assets) setThemeAssetsState(prev => ({ ...prev, ...settings.assets }));
    setAllowUserCustomization(settings.allowUserCustomization);
  };

  const getAccentClasses = (): ThemeContextType['accentClasses'] => {
    switch (activeThemeId) {
      case 'emerald':
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500',
          border: 'border-emerald-500/30',
          ring: 'focus:ring-emerald-500/50',
          gradient: 'from-emerald-500 to-teal-600',
          shadow: 'shadow-emerald-500/20'
        };
      case 'midnight':
        return {
          text: 'text-cyan-400',
          bg: 'bg-cyan-500',
          border: 'border-cyan-500/30',
          ring: 'focus:ring-cyan-500/50',
          gradient: 'from-cyan-500 to-blue-600',
          shadow: 'shadow-cyan-500/20'
        };
      case 'cyberpunk':
        return {
          text: 'text-fuchsia-400',
          bg: 'bg-fuchsia-500',
          border: 'border-fuchsia-500/30',
          ring: 'focus:ring-fuchsia-500/50',
          gradient: 'from-fuchsia-500 via-purple-600 to-pink-500',
          shadow: 'shadow-fuchsia-500/20'
        };
      case 'crimson':
        return {
          text: 'text-red-400',
          bg: 'bg-red-500',
          border: 'border-red-500/30',
          ring: 'focus:ring-red-500/50',
          gradient: 'from-rose-500 via-red-600 to-amber-600',
          shadow: 'shadow-red-500/20'
        };
      case 'sapphire':
        return {
          text: 'text-blue-400',
          bg: 'bg-blue-500',
          border: 'border-blue-500/30',
          ring: 'focus:ring-blue-500/50',
          gradient: 'from-blue-500 to-indigo-600',
          shadow: 'shadow-blue-500/20'
        };
      case 'golden':
      default:
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500',
          border: 'border-amber-500/30',
          ring: 'focus:ring-amber-500/50',
          gradient: 'from-amber-500 via-yellow-500 to-amber-600',
          shadow: 'shadow-amber-500/20'
        };
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        activeThemeId,
        activePreset,
        activeFontId,
        activeFont,
        accent,
        customCursorEnabled,
        animationsEnabled,
        adsEnabled,
        allowUserCustomization,
        backgroundBlur,
        backgroundOverlayOpacity,
        themeAssets,
        setTheme,
        setActiveThemeId,
        setActiveFontId,
        setAccent,
        setCustomCursorEnabled,
        setAnimationsEnabled,
        setAdsEnabled,
        setBackgroundBlur,
        setBackgroundOverlayOpacity,
        setThemeAssets,
        applySystemThemeSettings,
        accentClasses: getAccentClasses()
      }}
    >
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
