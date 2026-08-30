import React, { useState, useEffect } from 'react';
import { Palette, Type, Check, RefreshCw, Sparkles, Sliders, Eye, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';
import { useAnimation } from '../../lib/AnimationContext';
import { THEME_PRESETS, FONT_OPTIONS } from '../../lib/theme';
import { apiRequest } from '../../lib/api';

export const AdminAppearance: React.FC = () => {
  const {
    activeThemeId,
    setActiveThemeId,
    activeFontId,
    setActiveFontId,
    theme,
    setTheme,
    themeAssets,
    setThemeAssets,
    applySystemThemeSettings
  } = useTheme();

  const { refreshSettings } = useAnimation();

  const [selectedThemeId, setSelectedThemeId] = useState(activeThemeId || 'golden');
  const [selectedFontId, setSelectedFontId] = useState(activeFontId || 'Plus Jakarta Sans');
  const [logoUrl, setLogoUrl] = useState(themeAssets.logoUrl || '');
  const [faviconUrl, setFaviconUrl] = useState(themeAssets.faviconUrl || '');
  const [bgPatternUrl, setBgPatternUrl] = useState(themeAssets.bgPatternUrl || '');
  const [bannerUrl, setBannerUrl] = useState(themeAssets.bannerUrl || '');
  const [cardStyle, setCardStyle] = useState<'rounded-2xl' | 'rounded-xl' | 'rounded-lg'>('rounded-2xl');
  const [glowIntensity, setGlowIntensity] = useState<'vibrant' | 'subtle' | 'none'>('vibrant');
  const [allowUserCustomization, setAllowUserCustomization] = useState(true);
  const [backgroundBlur, setBackgroundBlur] = useState<string>('none');
  const [backgroundOverlayOpacity, setBackgroundOverlayOpacity] = useState<number>(75);

  const [animationsEnabled, setAnimationsEnabledState] = useState(true);
  const [pageTransitionsEnabled, setPageTransitionsEnabled] = useState(true);
  const [initialPanelAnimationEnabled, setInitialPanelAnimationEnabled] = useState(true);
  const [animationIntensity, setAnimationIntensity] = useState<'subtle' | 'normal' | 'enhanced'>('normal');

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const res = await apiRequest('/admin/theme-settings');
      if (res.success && res.data) {
        const d = res.data;
        if (d.activeThemeId) setSelectedThemeId(d.activeThemeId);
        if (d.activeFontId) setSelectedFontId(d.activeFontId);
        if (d.assets) {
          setLogoUrl(d.assets.logoUrl || '');
          setFaviconUrl(d.assets.faviconUrl || '');
          setBgPatternUrl(d.assets.bgPatternUrl || '');
          setBannerUrl(d.assets.bannerUrl || '');
        }
        if (d.cardStyle) setCardStyle(d.cardStyle);
        if (d.glowIntensity) setGlowIntensity(d.glowIntensity);
        if (d.allowUserCustomization !== undefined) setAllowUserCustomization(d.allowUserCustomization);
        if (d.backgroundBlur) setBackgroundBlur(d.backgroundBlur);
        if (d.backgroundOverlayOpacity !== undefined) setBackgroundOverlayOpacity(d.backgroundOverlayOpacity);
      }
    };

    const loadAnimations = async () => {
      const res = await apiRequest('/settings/appearance');
      if (res.success && res.data) {
        const d = res.data;
        setAnimationsEnabledState(d.enabled ?? true);
        setPageTransitionsEnabled(d.pageTransitions ?? true);
        setInitialPanelAnimationEnabled(d.initialPanelAnimation ?? true);
        setAnimationIntensity(d.intensity ?? 'normal');
      }
    };

    loadSettings();
    loadAnimations();
  }, []);

  const handleSaveTheme = async () => {
    setLoading(true);
    setErrorMsg(null);

    const payloadTheme = {
      activeThemeId: selectedThemeId,
      activeFontId: selectedFontId,
      cardStyle,
      glowIntensity,
      allowUserCustomization,
      backgroundBlur,
      backgroundOverlayOpacity,
      assets: {
        logoUrl: logoUrl.trim(),
        faviconUrl: faviconUrl.trim(),
        bgPatternUrl: bgPatternUrl.trim(),
        bannerUrl: bannerUrl.trim()
      }
    };

    const payloadAnim = {
      enabled: animationsEnabled,
      pageTransitions: pageTransitionsEnabled,
      initialPanelAnimation: initialPanelAnimationEnabled,
      intensity: animationIntensity
    };

    const resTheme = await apiRequest('/admin/theme-settings', {
      method: 'PUT',
      body: JSON.stringify(payloadTheme)
    });

    const resAnim = await apiRequest('/admin/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify(payloadAnim)
    });

    if (resTheme.success && resAnim.success) {
      setActiveThemeId(selectedThemeId);
      setActiveFontId(selectedFontId);
      setThemeAssets(payloadTheme.assets);
      applySystemThemeSettings(payloadTheme as any);
      await refreshSettings();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setErrorMsg(
        (!resTheme.success ? resTheme.error?.message : '') ||
        (!resAnim.success ? resAnim.error?.message : '') ||
        'Failed to save appearance settings.'
      );
    }
    setLoading(false);
  };

  const handleResetDefaults = () => {
    setSelectedThemeId('golden');
    setSelectedFontId('Plus Jakarta Sans');
    setLogoUrl('');
    setFaviconUrl('');
    setBgPatternUrl('');
    setBannerUrl('');
    setCardStyle('rounded-2xl');
    setGlowIntensity('vibrant');
    setAllowUserCustomization(true);
    setBackgroundBlur('none');
    setBackgroundOverlayOpacity(75);
    setTheme('dark');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sliders className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Themes, Fonts & Visual Assets</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Customize the global look and feel of AetherPanel. Set primary color palettes, typography, custom logos, and wallpaper animations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
            <span>Reset to Default</span>
          </button>
          <button
            onClick={handleSaveTheme}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedSuccess ? (
              <Check className="h-4 w-4 stroke-[3]" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>{savedSuccess ? 'Settings Saved!' : 'Save & Publish Theme'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Theme Presets & Typography */}
        <div className="lg:col-span-2 space-y-6">
          {/* Theme Presets Selection */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Active Theme Preset
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                ACTIVE: {selectedThemeId.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {THEME_PRESETS.map((item) => {
                const isSelected = selectedThemeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedThemeId(item.id)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-zinc-800/90 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white">{item.name}</div>
                      {isSelected && <Check className="h-4 w-4 text-amber-400 stroke-[3]" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{item.description}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {item.previewColors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-4 h-4 rounded-full border border-black/40 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typography Config */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  System Font Typography
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                {selectedFontId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FONT_OPTIONS.map((f) => {
                const isSelected = selectedFontId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFontId(f.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-zinc-800/90 border-amber-500 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs font-bold text-white">{f.name}</div>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                        {f.category}
                      </span>
                    </div>
                    <div
                      className="text-xs text-zinc-300 mt-2 truncate"
                      style={{ fontFamily: f.fontFamily }}
                    >
                      {f.sample}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interface Animations & Page Transitions */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Interface Animations & Transitions
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                animationsEnabled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {animationsEnabled ? 'ANIMATIONS ACTIVE' : 'ANIMATIONS MUTED'}
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Enable premium, lightweight transitions, micro-interactions, and entrances. Supports low-latency performance constraints and accessibility preferences.
            </p>

            <div className="space-y-4 pt-2">
              {/* Master Animation Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-white">Enable Interface Animations</div>
                  <div className="text-[11px] text-zinc-400">Master switch for all frontend visual animations.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={animationsEnabled}
                    onChange={(e) => setAnimationsEnabledState(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Page Transitions Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-white">Enable Page Transitions</div>
                  <div className="text-[11px] text-zinc-400">Animate navigation transitions between control panel views.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pageTransitionsEnabled}
                    disabled={!animationsEnabled}
                    onChange={(e) => setPageTransitionsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white peer-disabled:opacity-40 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Initial Panel Entrance Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-white">Enable Initial Panel Entrance Animation</div>
                  <div className="text-[11px] text-zinc-400">Subtle slide and fade-in entrances upon fresh logins and reloads.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={initialPanelAnimationEnabled}
                    disabled={!animationsEnabled}
                    onChange={(e) => setInitialPanelAnimationEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white peer-disabled:opacity-40 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Animation Intensity Selector */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-zinc-300">Animation Intensity Profile</label>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                  {(['subtle', 'normal', 'enhanced'] as const).map((profile) => {
                    const isSelected = animationIntensity === profile;
                    const label = profile === 'subtle' ? 'Subtle (Fast)' : profile === 'enhanced' ? 'Enhanced' : 'Normal (Fluent)';
                    return (
                      <button
                        key={profile}
                        type="button"
                        disabled={!animationsEnabled}
                        onClick={() => setAnimationIntensity(profile)}
                        className={`py-2 px-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800/90 border-amber-500 text-white shadow-md ring-1 ring-amber-500/40 font-bold'
                            : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:bg-zinc-900 peer-disabled:opacity-45'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Custom Asset URLs & Preview */}
        <div className="space-y-6">
          {/* Custom Assets URLs */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Custom Assets & URLs
              </h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Logo Image URL</label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Favicon URL</label>
                <input
                  type="text"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://example.com/favicon.ico"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Background Wallpaper / Animated GIF URL
                </label>
                <input
                  type="text"
                  value={bgPatternUrl}
                  onChange={(e) => setBgPatternUrl(e.target.value)}
                  placeholder="https://i.imgur.com/... or https://...gif"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Supports Imgur links, direct PNG/JPEG, and loop animated GIFs.
                </p>
              </div>

              {bgPatternUrl && (
                <div className="rounded-xl border border-zinc-800 p-2 bg-zinc-950 overflow-hidden">
                  <div className="text-[10px] text-zinc-400 font-semibold mb-1">Wallpaper Live Preview:</div>
                  <div
                    className="h-24 rounded-lg bg-cover bg-center border border-zinc-800"
                    style={{ backgroundImage: `url('${bgPatternUrl}')` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Background Styling Options */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Background FX (Blur & Contrast)
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Background Blur Intensity</label>
                <select
                  value={backgroundBlur}
                  onChange={(e) => setBackgroundBlur(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="none">None (0px)</option>
                  <option value="4px">Small (4px)</option>
                  <option value="8px">Medium (8px)</option>
                  <option value="12px">Large (12px)</option>
                  <option value="20px">Extra Large (20px)</option>
                  <option value="32px">Max (32px)</option>
                  <option value="40px">Extreme (40px)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-zinc-300 font-medium">Background Overlay Opacity</label>
                  <span className="text-amber-400 font-mono font-bold">{backgroundOverlayOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="95"
                  step="5"
                  value={backgroundOverlayOpacity}
                  onChange={(e) => setBackgroundOverlayOpacity(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Adjusts the darkness of the tint layer sitting on top of your background wallpaper to guarantee text legibility.
                </p>
              </div>
            </div>
          </div>

          {/* User Customization Toggle */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Permissions
            </h3>
            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="text-xs font-semibold text-white">Allow User Personalization</div>
                <div className="text-[11px] text-zinc-400">Permit individual users to pick custom client-side themes.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowUserCustomization}
                  onChange={(e) => setAllowUserCustomization(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
