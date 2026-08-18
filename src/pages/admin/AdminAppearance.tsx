import React, { useState } from 'react';
import { Palette, Type, Check, RefreshCw, Sparkles, Sliders, Eye } from 'lucide-react';
import { useTheme, AccentColor, FontFamily } from '../../lib/ThemeContext';

export const AdminAppearance: React.FC = () => {
  const { accent, setAccent, theme, setTheme, font, setFont, accentClasses } = useTheme();

  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(accent);
  const [selectedUiFont, setSelectedUiFont] = useState<FontFamily>(font || 'inter');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const accentsList: { id: AccentColor; name: string; gradient: string; hex: string }[] = [
    { id: 'amber', name: 'Aether Golden', gradient: 'from-amber-400 to-yellow-600', hex: '#f59e0b' },
    { id: 'cyan', name: 'Aether Cyber Cyan', gradient: 'from-cyan-400 to-blue-600', hex: '#06b6d4' },
    { id: 'emerald', name: 'Aether Matrix Emerald', gradient: 'from-emerald-400 to-teal-600', hex: '#10b981' },
    { id: 'rose', name: 'Aether Crimson Rose', gradient: 'from-rose-400 to-red-600', hex: '#f43f5e' },
    { id: 'violet', name: 'Aether Royal Violet', gradient: 'from-purple-400 to-indigo-600', hex: '#a855f7' },
  ];

  const handleSaveTheme = () => {
    setAccent(selectedAccent);
    setFont(selectedUiFont);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    setSelectedAccent('amber');
    setSelectedUiFont('inter');
    setAccent('amber');
    setFont('inter');
    setTheme('dark');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 p-6 rounded-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sliders className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Fonts & Theme Appearance</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Configure global brand accents, default system themes, and typography roles across AetherPanel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-400" />
            <span>Reset to Golden Default</span>
          </button>
          <button
            onClick={handleSaveTheme}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            {savedSuccess ? <Check className="h-4 w-4 stroke-[3]" /> : <Sparkles className="h-4 w-4" />}
            <span>{savedSuccess ? 'Settings Applied!' : 'Apply Brand Settings'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Accent Colors & Dark/Light Mode */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brand Accent Selection */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Primary Brand Accent
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                ACTIVE: {selectedAccent.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accentsList.map((item) => {
                const isSelected = selectedAccent === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedAccent(item.id)}
                    className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-zinc-800/80 border-amber-500/60 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-zinc-950/50 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.gradient} shadow-sm shrink-0 flex items-center justify-center`}>
                        {isSelected && <Check className="h-4 w-4 text-zinc-950 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{item.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono">{item.hex}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Mode Preference */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span>Theme Interface Mode</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`p-3.5 rounded-xl border text-center transition-all ${
                    theme === mode
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 font-bold'
                      : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="capitalize text-xs">{mode} Mode</span>
                </button>
              ))}
            </div>
          </div>

          {/* Typography Config */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                System Typography & Fonts
              </h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Primary System Font</label>
              <select
                value={selectedUiFont}
                onChange={(e) => setSelectedUiFont(e.target.value as FontFamily)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="inter">Inter / Plus Jakarta Sans (Default)</option>
                <option value="geist">Geist Sans</option>
                <option value="jetbrains">JetBrains Mono (Monospace)</option>
                <option value="system-sans">System Sans-Serif</option>
                <option value="system-mono">System Monospace</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Preview Card */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-5 sticky top-24">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <Eye className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Real-Time UI Preview
              </h3>
            </div>

            {/* Simulated Panel Card */}
            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                  PREVIEW CARD
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ONLINE
                </span>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-white">
                  AetherPanel Cloud Node
                </h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Manage high-performance Minecraft & Discord Bot instances with instant scaling.
                </p>
              </div>

              {/* Sample Code Block */}
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-amber-300">
                <code>$ systemctl status aether-daemon</code>
              </div>

              {/* Sample Button */}
              <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-zinc-950 font-bold text-xs shadow-md">
                Primary Action Button
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
