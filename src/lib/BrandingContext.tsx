import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from './api';

interface BrandingContextType {
  brandName: string;
  brandTagline: string;
  supportEmail: string;
  discordUrl: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enablePlayit: boolean;
  refreshBranding: () => Promise<void>;
  updateBrandNameLocally: (newName: string) => void;
  setEnablePlayitLocally: (enabled: boolean) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandName, setBrandName] = useState<string>(() => {
    return localStorage.getItem('aether_brand_name') || 'AetherPanel';
  });
  const [brandTagline, setBrandTagline] = useState<string>('Premium Minecraft & Discord Bot Hosting');
  const [supportEmail, setSupportEmail] = useState<string>('support@aetherpanel.com');
  const [discordUrl, setDiscordUrl] = useState<string>('https://discord.gg');
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('AetherPanel is currently performing scheduled system upgrades.');
  const [enablePlayit, setEnablePlayit] = useState<boolean>(() => {
    const saved = localStorage.getItem('aether_enable_playit');
    return saved !== null ? saved === 'true' : true;
  });

  const fetchBranding = useCallback(async () => {
    try {
      const res = await apiRequest('/public/settings');
      if (res.success && res.data) {
        if (res.data.brandName) {
          setBrandName(res.data.brandName);
          localStorage.setItem('aether_brand_name', res.data.brandName);
        }
        if (res.data.brandTagline) setBrandTagline(res.data.brandTagline);
        if (res.data.supportEmail) setSupportEmail(res.data.supportEmail);
        if (res.data.discordUrl) setDiscordUrl(res.data.discordUrl);
        if (res.data.maintenanceMode !== undefined) setMaintenanceMode(res.data.maintenanceMode);
        if (res.data.maintenanceMessage) setMaintenanceMessage(res.data.maintenanceMessage);
        if (res.data.enablePlayit !== undefined) {
          setEnablePlayit(res.data.enablePlayit);
          localStorage.setItem('aether_enable_playit', String(res.data.enablePlayit));
        }
      }
    } catch (err) {
      console.error('[BrandingContext] Failed to load branding settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Update document.title dynamically when brandName updates
  useEffect(() => {
    if (brandName) {
      document.title = `${brandName} — Premium Minecraft & Discord Bot Hosting`;
    }
  }, [brandName]);

  const updateBrandNameLocally = (newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) {
      setBrandName(trimmed);
      localStorage.setItem('aether_brand_name', trimmed);
      document.title = `${trimmed} — Premium Minecraft & Discord Bot Hosting`;
    }
  };

  const setEnablePlayitLocally = (enabled: boolean) => {
    setEnablePlayit(enabled);
    localStorage.setItem('aether_enable_playit', String(enabled));
  };

  return (
    <BrandingContext.Provider
      value={{
        brandName,
        brandTagline,
        supportEmail,
        discordUrl,
        maintenanceMode,
        maintenanceMessage,
        enablePlayit,
        refreshBranding: fetchBranding,
        updateBrandNameLocally,
        setEnablePlayitLocally
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
