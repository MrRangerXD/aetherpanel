import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from './api';
import { useAuth } from './AuthContext';
import { AnimationSettings } from '../types';

interface AnimationContextType {
  settings: AnimationSettings;
  updateSettings: (newSettings: AnimationSettings) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
  motionEnabled: boolean;
  getTransitionProps: (type?: 'page' | 'modal' | 'dropdown' | 'panel' | 'stagger') => {
    initial: any;
    animate: any;
    exit: any;
    transition: any;
  };
}

const defaultSettings: AnimationSettings = {
  enabled: true,
  pageTransitions: true,
  initialPanelAnimation: true,
  intensity: 'normal',
};

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AnimationSettings>(defaultSettings);
  const [motionReduced, setMotionReduced] = useState(false);

  // Monitor prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMotionReduced(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setMotionReduced(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const refreshSettings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiRequest('/settings/appearance');
      if (res.success && res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error('Failed to load appearance settings:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshSettings();
    } else {
      setSettings(defaultSettings);
    }
  }, [user, refreshSettings]);

  const updateSettings = async (newSettings: AnimationSettings): Promise<boolean> => {
    try {
      const res = await apiRequest('/admin/settings/appearance', {
        method: 'PUT',
        body: JSON.stringify(newSettings)
      });
      if (res.success && res.data) {
        setSettings(res.data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save appearance settings:', err);
      return false;
    }
  };

  const motionEnabled = settings.enabled && !motionReduced;

  // Determine transition speeds and styles
  const getTransitionProps = useCallback((type: 'page' | 'modal' | 'dropdown' | 'panel' | 'stagger' = 'page') => {
    if (!motionEnabled) {
      return {
        initial: { opacity: 1, x: 0, y: 0, scale: 1 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 1, x: 0, y: 0, scale: 1 },
        transition: { duration: 0 }
      };
    }

    let duration = 0.22;
    let yOffset = 12;
    let ease: any = [0.16, 1, 0.3, 1]; // Out-quart

    if (settings.intensity === 'subtle') {
      duration = 0.15;
      yOffset = 6;
      ease = [0.25, 0.1, 0.25, 1]; // standard ease
    } else if (settings.intensity === 'enhanced') {
      duration = 0.30;
      yOffset = 20;
      ease = [0.34, 1.56, 0.64, 1]; // subtle bouncy Out-elastic
    }

    if (type === 'page') {
      // If page transitions are disabled specifically
      if (!settings.pageTransitions) {
        return {
          initial: { opacity: 1, y: 0 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 1, y: 0 },
          transition: { duration: 0 }
        };
      }
      return {
        initial: { opacity: 0, y: yOffset },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -yOffset },
        transition: { duration, ease }
      };
    }

    if (type === 'panel') {
      // Initial panel load
      if (!settings.initialPanelAnimation) {
        return {
          initial: { opacity: 1, x: 0, y: 0 },
          animate: { opacity: 1, x: 0, y: 0 },
          exit: { opacity: 1, x: 0, y: 0 },
          transition: { duration: 0 }
        };
      }
      return {
        initial: { opacity: 0, y: yOffset * 1.5 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -yOffset * 1.5 },
        transition: { duration: duration * 1.2, ease }
      };
    }

    if (type === 'modal') {
      return {
        initial: { opacity: 0, scale: 0.96, y: yOffset },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: yOffset },
        transition: { duration: duration * 0.9, ease }
      };
    }

    if (type === 'dropdown') {
      return {
        initial: { opacity: 0, scale: 0.98, y: -4 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.98, y: -4 },
        transition: { duration: duration * 0.7, ease }
      };
    }

    if (type === 'stagger') {
      return {
        initial: { opacity: 0, y: yOffset * 0.5 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -yOffset * 0.5 },
        transition: { duration: duration * 0.8, ease }
      };
    }

    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration }
    };
  }, [motionEnabled, settings]);

  return (
    <AnimationContext.Provider value={{
      settings,
      updateSettings,
      refreshSettings,
      motionEnabled,
      getTransitionProps
    }}>
      {children}
    </AnimationContext.Provider>
  );
};

export const useAnimation = () => {
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
};
