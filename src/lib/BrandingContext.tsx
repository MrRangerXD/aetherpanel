import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from './api';
import { SocialLinks } from '../types';

interface BrandingContextType {
  brandName: string;
  brandTagline: string;
  supportEmail: string;
  discordUrl: string;
  socialLinks: SocialLinks;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enablePlayit: boolean;
  pageAnimationsEnabled: boolean;
  heroDescription: string;
  footerDescription: string;
  refreshBranding: () => Promise<void>;
  updateBrandNameLocally: (newName: string) => void;
  setEnablePlayitLocally: (enabled: boolean) => void;
  setPageAnimationsEnabledLocally: (enabled: boolean) => void;
  setSocialLinksLocally: (links: SocialLinks) => void;
  setHomepageDescriptionsLocally: (hero: string, footer: string) => void;
}

const DEFAULT_HERO_DESCRIPTION = 'Deploy high-performance Minecraft servers and 24/7 Discord bots in under 30 seconds. Powered by AMD Ryzen 9 7950X compute nodes, enterprise NVMe storage, and Pterodactyl-class control precision.';
const DEFAULT_FOOTER_DESCRIPTION = 'Premium Minecraft & Discord Bot hosting infrastructure built on high-clock AMD Ryzen 9 nodes and NVMe enterprise storage.';

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandName, setBrandName] = useState<string>(() => {
    return localStorage.getItem('aether_brand_name') || 'AetherPanel';
  });
  const [brandTagline, setBrandTagline] = useState<string>('Premium Minecraft & Discord Bot Hosting');
  const [supportEmail, setSupportEmail] = useState<string>('support@aetherpanel.com');
  const [discordUrl, setDiscordUrl] = useState<string>('https://discord.gg/aetherpanel');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(() => {
    const saved = localStorage.getItem('aether_social_links');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      discord: 'https://discord.gg/aetherpanel',
      twitter: 'https://twitter.com/aetherpanel',
      github: 'https://github.com/aetherpanel'
    };
  });
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('AetherPanel is currently performing scheduled system upgrades.');
  const [enablePlayit, setEnablePlayit] = useState<boolean>(() => {
    const saved = localStorage.getItem('aether_enable_playit');
    return saved !== null ? saved === 'true' : true;
  });
  const [pageAnimationsEnabled, setPageAnimationsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('aether_page_animations_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [heroDescription, setHeroDescription] = useState<string>(DEFAULT_HERO_DESCRIPTION);
  const [footerDescription, setFooterDescription] = useState<string>(DEFAULT_FOOTER_DESCRIPTION);

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
        if (res.data.socialLinks) {
          setSocialLinks(res.data.socialLinks);
          localStorage.setItem('aether_social_links', JSON.stringify(res.data.socialLinks));
          if (res.data.socialLinks.discord) {
            setDiscordUrl(res.data.socialLinks.discord);
          }
        }
        if (res.data.maintenanceMode !== undefined) setMaintenanceMode(res.data.maintenanceMode);
        if (res.data.maintenanceMessage) setMaintenanceMessage(res.data.maintenanceMessage);
        if (res.data.enablePlayit !== undefined) {
          setEnablePlayit(res.data.enablePlayit);
          localStorage.setItem('aether_enable_playit', String(res.data.enablePlayit));
        }
        if (res.data.pageAnimationsEnabled !== undefined) {
          setPageAnimationsEnabled(res.data.pageAnimationsEnabled);
          localStorage.setItem('aether_page_animations_enabled', String(res.data.pageAnimationsEnabled));
        }
        if (typeof res.data.heroDescription === 'string' && res.data.heroDescription.trim().length > 0) {
          setHeroDescription(res.data.heroDescription);
        } else {
          setHeroDescription(DEFAULT_HERO_DESCRIPTION);
        }
        if (typeof res.data.footerDescription === 'string' && res.data.footerDescription.trim().length > 0) {
          setFooterDescription(res.data.footerDescription);
        } else {
          setFooterDescription(DEFAULT_FOOTER_DESCRIPTION);
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

  const setPageAnimationsEnabledLocally = (enabled: boolean) => {
    setPageAnimationsEnabled(enabled);
    localStorage.setItem('aether_page_animations_enabled', String(enabled));
  };

  const setSocialLinksLocally = (links: SocialLinks) => {
    setSocialLinks(links);
    localStorage.setItem('aether_social_links', JSON.stringify(links));
    if (links.discord) {
      setDiscordUrl(links.discord);
    }
  };

  const setHomepageDescriptionsLocally = (hero: string, footer: string) => {
    if (hero) setHeroDescription(hero);
    if (footer) setFooterDescription(footer);
  };

  return (
    <BrandingContext.Provider
      value={{
        brandName,
        brandTagline,
        supportEmail,
        discordUrl,
        socialLinks,
        maintenanceMode,
        maintenanceMessage,
        enablePlayit,
        pageAnimationsEnabled,
        heroDescription,
        footerDescription,
        refreshBranding: fetchBranding,
        updateBrandNameLocally,
        setEnablePlayitLocally,
        setPageAnimationsEnabledLocally,
        setSocialLinksLocally,
        setHomepageDescriptionsLocally
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
