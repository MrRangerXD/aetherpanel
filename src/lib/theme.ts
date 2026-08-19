export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  accent: string;
  accentHover: string;
  bgBase: string;
  bgCard: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  gradient: string;
  glowColor: string;
  previewColors: string[];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'golden',
    name: 'Aether Gold (Default)',
    description: 'The signature dark gold obsidian luxury palette with high-contrast amber highlights.',
    accent: '#f59e0b',
    accentHover: '#d97706',
    bgBase: '#09090b',
    bgCard: '#18181b',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeText: '#fbbf24',
    gradient: 'from-amber-500 via-yellow-500 to-amber-600',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    previewColors: ['#09090b', '#18181b', '#f59e0b', '#fbbf24']
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    description: 'Deep forest obsidian with neon emerald green accents.',
    accent: '#10b981',
    accentHover: '#059669',
    bgBase: '#06110d',
    bgCard: '#0f231c',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#34d399',
    gradient: 'from-emerald-500 via-teal-500 to-emerald-600',
    glowColor: 'rgba(16, 185, 129, 0.3)',
    previewColors: ['#06110d', '#0f231c', '#10b981', '#34d399']
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Electrifying neon purple and magenta accents against ultra-dark carbon.',
    accent: '#d946ef',
    accentHover: '#c026d3',
    bgBase: '#0a0512',
    bgCard: '#180d28',
    borderColor: 'rgba(217, 70, 239, 0.3)',
    badgeBg: 'rgba(217, 70, 239, 0.15)',
    badgeText: '#f0abfc',
    gradient: 'from-fuchsia-500 via-purple-600 to-pink-500',
    glowColor: 'rgba(217, 70, 239, 0.35)',
    previewColors: ['#0a0512', '#180d28', '#d946ef', '#f0abfc']
  },
  {
    id: 'midnight',
    name: 'Midnight Deep Blue',
    description: 'Deep naval cobalt with vibrant electric cyan highlights.',
    accent: '#06b6d4',
    accentHover: '#0891b2',
    bgBase: '#040d1a',
    bgCard: '#0b1b30',
    borderColor: 'rgba(6, 182, 212, 0.25)',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeText: '#67e8f9',
    gradient: 'from-cyan-500 via-blue-600 to-cyan-600',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    previewColors: ['#040d1a', '#0b1b30', '#06b6d4', '#67e8f9']
  },
  {
    id: 'crimson',
    name: 'Crimson Ruby',
    description: 'Volcanic slate with fierce crimson red and ruby highlights.',
    accent: '#ef4444',
    accentHover: '#dc2626',
    bgBase: '#120505',
    bgCard: '#220b0b',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeText: '#f87171',
    gradient: 'from-rose-500 via-red-600 to-amber-600',
    glowColor: 'rgba(239, 68, 68, 0.3)',
    previewColors: ['#120505', '#220b0b', '#ef4444', '#f87171']
  },
  {
    id: 'sapphire',
    name: 'Royal Sapphire',
    description: 'Imperial royal blue with deep indigo and twilight accents.',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    bgBase: '#080c18',
    bgCard: '#111827',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeText: '#93c5fd',
    gradient: 'from-blue-500 via-indigo-600 to-blue-700',
    glowColor: 'rgba(59, 130, 246, 0.3)',
    previewColors: ['#080c18', '#111827', '#3b82f6', '#93c5fd']
  }
];

export interface FontOption {
  id: string;
  name: string;
  category: 'sans' | 'display' | 'mono';
  fontFamily: string;
  sample: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'Plus Jakarta Sans',
    name: 'Plus Jakarta Sans (Default)',
    category: 'sans',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    sample: 'Sphinx of black quartz, judge my vow.'
  },
  {
    id: 'Outfit',
    name: 'Outfit',
    category: 'display',
    fontFamily: '"Outfit", sans-serif',
    sample: 'Modern, high-contrast geometric display typeface.'
  },
  {
    id: 'Inter',
    name: 'Inter',
    category: 'sans',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    sample: 'Ultra-clean, crisp developer UI typography.'
  },
  {
    id: 'Space Grotesk',
    name: 'Space Grotesk',
    category: 'display',
    fontFamily: '"Space Grotesk", sans-serif',
    sample: 'Futuristic technical aesthetic for high-tech dashboards.'
  },
  {
    id: 'JetBrains Mono',
    name: 'JetBrains Mono',
    category: 'mono',
    fontFamily: '"JetBrains Mono", monospace',
    sample: 'Precision monospace crafted for terminal and code lovers.'
  },
  {
    id: 'Poppins',
    name: 'Poppins',
    category: 'sans',
    fontFamily: '"Poppins", sans-serif',
    sample: 'Friendly, rounded geometric typographic curves.'
  },
  {
    id: 'Syne',
    name: 'Syne',
    category: 'display',
    fontFamily: '"Syne", sans-serif',
    sample: 'Artistic, expressive editorial display heading font.'
  },
  {
    id: 'Fira Code',
    name: 'Fira Code',
    category: 'mono',
    fontFamily: '"Fira Code", monospace',
    sample: 'Iconic developer typeface with programming ligatures.'
  }
];
