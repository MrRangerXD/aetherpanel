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
      <div className="absolute inset-0 bg-[#09090b]" />

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
