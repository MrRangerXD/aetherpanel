import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from './api';

interface BrandingContextType {
  brandName: string;
  brandTagline: string;
  supportEmail: string;
  discordUrl: string;
  refreshBranding: () => Promise<void>;
  updateBrandNameLocally: (newName: string) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandName, setBrandName] = useState<string>(() => {
    return localStorage.getItem('aether_brand_name') || 'AetherPanel';
  });
  const [brandTagline, setBrandTagline] = useState<string>('Premium Minecraft & Discord Bot Hosting');
  const [supportEmail, setSupportEmail] = useState<string>('support@aetherpanel.com');
  const [discordUrl, setDiscordUrl] = useState<string>('https://discord.gg');

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

  return (
    <BrandingContext.Provider
      value={{
        brandName,
        brandTagline,
        supportEmail,
        discordUrl,
        refreshBranding: fetchBranding,
        updateBrandNameLocally
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
