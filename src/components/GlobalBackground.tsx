import React, { useState, useEffect } from 'react';
import { useTheme } from '../lib/ThemeContext';

export const GlobalBackground: React.FC = () => {
  const { themeAssets, backgroundBlur, backgroundOverlayOpacity } = useTheme();
  const [hasError, setHasError] = useState(false);

  // Normalize wallpaper URL from either property
  const wallpaperUrl = (themeAssets.backgroundWallpaperUrl || themeAssets.bgPatternUrl || '').trim();

  // Reset error state when the wallpaper URL changes
  useEffect(() => {
    setHasError(false);
  }, [wallpaperUrl]);

  const blurVal = !backgroundBlur || backgroundBlur === 'none' ? '0px' : backgroundBlur;
  const isBlurred = blurVal !== '0px';
  const overlayOpacity = Math.min(100, Math.max(0, backgroundOverlayOpacity ?? 75)) / 100;

  return (
    <div
      id="aether-wallpaper-layer"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* Base Canvas Layer */}
      <div className="absolute inset-0 bg-[#040406] overflow-hidden">
        {/* Subtle architectural dot grid */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(rgba(245, 158, 11, 0.4) 1px, transparent 1px)`,
            backgroundSize: '28px 28px'
          }}
        />
        {/* Soft, restrained amber warmth at top center behind hero */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-amber-500/[0.05] blur-[150px] pointer-events-none" />
        {/* Deep subtle warm obsidian vignette */}
        <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-orange-600/[0.025] blur-[180px] pointer-events-none" />
      </div>

      {/* Wallpaper Image / Animated GIF Element - Native img preserves GIF animation frames */}
      {wallpaperUrl && !hasError && (
        <img
          src={wallpaperUrl}
          alt=""
          aria-hidden="true"
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-transform duration-300 pointer-events-none will-change-transform ${
            isBlurred ? 'scale-105' : 'scale-100'
          }`}
          style={{
            filter: isBlurred ? `blur(${blurVal})` : 'none',
            WebkitFilter: isBlurred ? `blur(${blurVal})` : 'none',
          }}
        />
      )}

      {/* Overlay Mask Element */}
      <div
        id="aether-overlay-layer"
        className="absolute inset-0 transition-colors duration-300 pointer-events-none"
        style={{
          backgroundColor: wallpaperUrl && !hasError ? `rgba(9, 9, 11, ${overlayOpacity})` : 'rgba(9, 9, 11, 0.4)',
        }}
      />
    </div>
  );
};
