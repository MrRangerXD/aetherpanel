import React, { useState, useEffect } from 'react';
import { useBranding } from '../lib/BrandingContext';
import { useTheme } from '../lib/ThemeContext';

interface AetherLogoProps {
  variant?: 'full' | 'compact';
  height?: number | string;
  className?: string;
  onClick?: () => void;
}

export const AetherLogo: React.FC<AetherLogoProps> = ({
  variant = 'full',
  height = 36,
  className = '',
  onClick
}) => {
  const { brandName } = useBranding();
  const { themeAssets } = useTheme();
  const [imgFailed, setImgFailed] = useState(false);

  const customLogoUrl = themeAssets?.logoUrl?.trim();

  // Reset image load error state whenever customLogoUrl changes
  useEffect(() => {
    setImgFailed(false);
  }, [customLogoUrl]);

  const showCustomLogo = Boolean(customLogoUrl && !imgFailed);

  // Parse brand name prefix & suffix for styling (e.g., "AetherPanel" -> "Aether" + "Panel")
  let prefix = brandName;
  let suffix = '';

  if (brandName.toLowerCase().endsWith('panel') && brandName.length > 5) {
    prefix = brandName.substring(0, brandName.length - 5);
    suffix = brandName.substring(brandName.length - 5);
  } else if (brandName.toLowerCase().endsWith('cloud') && brandName.length > 5) {
    prefix = brandName.substring(0, brandName.length - 5);
    suffix = brandName.substring(brandName.length - 5);
  } else if (brandName.includes(' ')) {
    const parts = brandName.split(' ');
    prefix = parts.slice(0, -1).join(' ');
    suffix = ' ' + parts[parts.length - 1];
  }

  // Square logo icon container
  const iconContainer = (
    <div className="relative flex items-center justify-center p-1 rounded-xl bg-zinc-900 border border-amber-500/30 group-hover:border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all shrink-0 w-9 h-9 overflow-hidden">
      {showCustomLogo ? (
        <img
          src={customLogoUrl}
          alt={brandName}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain rounded-lg transition-transform group-hover:scale-105"
        />
      ) : (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 60 60" fill="none">
          <defs>
            <linearGradient id="aetherLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#fbbf24" />
              <stop offset="80%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path d="M30 10 L50 21 V43 L30 54 L10 43 V21 Z" fill="none" stroke="url(#aetherLogoGrad)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M30 17 L42 28 L37 46 L30 40 L23 46 L18 28 Z" fill="url(#aetherLogoGrad)" />
          <circle cx="30" cy="30" r="4" fill="#09090b" />
        </svg>
      )}
    </div>
  );

  if (variant === 'compact') {
    return (
      <div 
        onClick={onClick} 
        className={`inline-flex items-center cursor-pointer select-none group shrink-0 ${className}`}
      >
        {iconContainer}
      </div>
    );
  }

  return (
    <div 
      onClick={onClick} 
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none group shrink-0 ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      {iconContainer}
      <div className="flex flex-col leading-none truncate">
        <span className="text-base sm:text-lg font-extrabold tracking-tight text-white font-sans flex items-center gap-0.5">
          {prefix}
          {suffix && (
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              {suffix}
            </span>
          )}
        </span>
        <span className="text-[8px] sm:text-[9px] font-bold tracking-widest text-zinc-400 uppercase mt-0.5 font-mono hidden min-[380px]:block">
          CLOUD INFRASTRUCTURE
        </span>
      </div>
    </div>
  );
};
