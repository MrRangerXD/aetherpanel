import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useTheme } from '../lib/ThemeContext';
import { AdItem, AdPlacement } from '../types';
import { ExternalLink, Sparkles, X } from 'lucide-react';

interface AdBannerProps {
  placement: AdPlacement;
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({ placement, className = '' }) => {
  const { adsEnabled } = useTheme();
  const [ad, setAd] = useState<AdItem | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!adsEnabled) return;

    let mounted = true;
    const fetchAd = async () => {
      try {
        const res: any = await apiRequest(`/ads?placement=${placement}`);
        if (res.success && res.ads && res.ads.length > 0 && mounted) {
          const selectedAd = res.ads[0];
          setAd(selectedAd);

          // Record impression
          apiRequest(`/ads/${selectedAd.id}/impression`, { method: 'POST' }).catch(() => {});
        }
      } catch (err) {
        // Silent fail for non-critical ad placement
      }
    };

    fetchAd();
    return () => {
      mounted = false;
    };
  }, [placement, adsEnabled]);

  if (!adsEnabled || !ad || dismissed) {
    return null;
  }

  const handleClick = async () => {
    try {
      await apiRequest(`/ads/${ad.id}/click`, { method: 'POST' });
    } catch (err) {
      // Ignore
    }

    if (ad.destinationUrl.startsWith('/')) {
      window.location.href = ad.destinationUrl;
    } else {
      window.open(ad.destinationUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (ad.type === 'card') {
    return (
      <div className={`relative bg-gradient-to-r from-violet-950/40 via-zinc-900 to-zinc-900 border border-violet-500/20 rounded-2xl p-4 shadow-sm hover:border-violet-500/40 transition-all group ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Sparkles className="w-3 h-3" />
              Promoted
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-4 cursor-pointer" onClick={handleClick}>
          <div>
            <h4 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
              {ad.title}
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-violet-400 transition-colors" />
            </h4>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{ad.description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r from-violet-950/50 via-zinc-900/90 to-zinc-950 border border-violet-500/30 rounded-2xl p-5 shadow-lg group ${className}`}>
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
          <Sparkles className="w-3 h-3 text-violet-400" />
          Sponsored
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer" onClick={handleClick}>
        <div className="max-w-2xl">
          <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors flex items-center gap-2">
            {ad.title}
            <ExternalLink className="w-4 h-4 text-violet-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 mt-1">{ad.description}</p>
        </div>

        <button
          onClick={handleClick}
          className="shrink-0 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
        >
          Learn More
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
