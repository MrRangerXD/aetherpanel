import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Gamepad2, Bot, Terminal, Code2, Server, Globe2,
  ArrowRight, ChevronLeft, ChevronRight, Play, Pause, Zap, Check
} from 'lucide-react';

export interface HeroSlide {
  id: string;
  category: string;
  tabLabel: string;
  icon: any;
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  description: string;
  price: string;
  period: string;
  primaryCtaText: string;
  primaryCtaAction: string;
  primaryCtaCategory?: string;
  secondaryCtaText: string;
  secondaryCtaTarget: string;
  bgGradient: string;
  bgImage?: string;
  accentColor: string;
  badge?: string;
}

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-bot',
    category: 'bot',
    tabLabel: 'Bot',
    icon: Bot,
    eyebrow: 'Discord & Telegram Automation',
    titlePrefix: 'Bot',
    titleAccent: 'Hosting',
    description: 'Deploy your Discord and Telegram bots on high-performance nodes with dedicated resources and 24/7 uptime. Low latency websockets and instant crash restarts.',
    price: '€1.00',
    period: '/mo',
    primaryCtaText: 'Start for Free',
    primaryCtaAction: 'deploy',
    primaryCtaCategory: 'bot',
    secondaryCtaText: 'View Plans',
    secondaryCtaTarget: '#pricing',
    bgGradient: 'from-orange-950/40 via-[#0a0a0b]/80 to-[#0a0a0b]',
    bgImage: '/assets/aistudio/bot-C5zW-1NS_d57d6927.png',
    accentColor: '#FF6A00',
    badge: '99.99% Uptime'
  },
  {
    id: 'slide-minecraft',
    category: 'minecraft',
    tabLabel: 'Minecraft',
    icon: Gamepad2,
    eyebrow: 'Extreme Single-Threaded Silicon',
    titlePrefix: 'Minecraft',
    titleAccent: 'Hosting',
    description: 'Experience Minecraft as it was meant to be played. Low latency, zero TPS drops, and effortless management across Paper, Purpur, Fabric & Forge.',
    price: '€1.49',
    period: '/mo',
    primaryCtaText: 'Deploy',
    primaryCtaAction: 'deploy',
    primaryCtaCategory: 'minecraft',
    secondaryCtaText: 'View Plans',
    secondaryCtaTarget: '#pricing',
    bgGradient: 'from-blue-950/40 via-[#0a0a0b]/80 to-[#0a0a0b]',
    bgImage: '/assets/aistudio/photo-1760114333175-0143a2a446da_3849eca9.png',
    accentColor: '#FF6A00',
    badge: 'Ryzen 9 7950X'
  }
];

interface RotatingHeroProps {
  onNavigate: (page: string, params?: any) => void;
  onSelectCategory?: (category: string) => void;
  customSlides?: HeroSlide[];
  intervalMs?: number;
  autoplayEnabled?: boolean;
}

export const RotatingHero: React.FC<RotatingHeroProps> = ({
  onNavigate,
  onSelectCategory,
  customSlides,
  intervalMs = 6000,
  autoplayEnabled = true
}) => {
  const slides = customSlides && customSlides.length > 0 ? customSlides : DEFAULT_HERO_SLIDES;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeSlide = slides[currentIndex] || slides[0];

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % slides.length);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Autoplay loop with tab blur and hover pause detection
  useEffect(() => {
    if (!autoplayEnabled || isPaused) return;

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    timerRef.current = setInterval(() => {
      handleNext();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoplayEnabled, isPaused, intervalMs, handleNext]);

  // Pause when browser tab is inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else if (!userInteracted) {
        setIsPaused(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userInteracted]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
        setUserInteracted(true);
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
        setUserInteracted(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const handleTabClick = (idx: number, category: string) => {
    setCurrentIndex(idx);
    setUserInteracted(true);
    if (onSelectCategory) {
      onSelectCategory(category);
    }
  };

  const handleSecondaryClick = (target: string, category: string) => {
    if (target.startsWith('#')) {
      if (onSelectCategory) {
        onSelectCategory(category);
      }
      const el = document.getElementById(target.replace('#', ''));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        onNavigate('pricing');
      }
    } else {
      onNavigate(target);
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden bg-[#0a0a0b] border-b border-[var(--color-line)] select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => !userInteracted && setIsPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Hosting Services Showcase"
    >
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. SLIDE BACKGROUND IMAGES (ORPHOST STYLE: VIVID RIGHT-ALIGNED ARTWORK)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-0">
        {slides.map((s, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              style={{ willChange: 'transform, opacity' }}
            >
              {s.bgImage ? (
                <div className="absolute right-0 top-0 bottom-0 w-full md:w-[65%] lg:w-[60%] flex items-center justify-end overflow-hidden">
                  {/* High-fidelity Artwork */}
                  <img
                    src={s.bgImage}
                    alt={s.titlePrefix}
                    fetchPriority={idx === 0 ? 'high' : 'auto'}
                    decoding="async"
                    className={`w-full h-full object-contain md:object-cover object-center md:object-right transition-transform duration-[7000ms] ease-out ${
                      isActive ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  {/* Left-edge smooth fade into solid background */}
                  <div className="absolute inset-y-0 left-0 w-36 sm:w-64 md:w-80 bg-gradient-to-r from-[#0a0a0b] via-[#0a0a0b]/80 to-transparent" />
                  {/* Bottom edge soft blend */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/60 to-transparent" />
                  {/* Top edge soft blend */}
                  <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0a0a0b] to-transparent" />
                </div>
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${s.bgGradient}`} />
              )}

              {/* Left Side Content Solid Backing */}
              <div className="absolute inset-y-0 left-0 w-full md:w-[50%] bg-[#0a0a0b] -z-10" />
            </div>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. MAIN HERO CONTENT AREA (ORPHOST STYLE DENSE & BOLD)
      ───────────────────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-12 sm:pb-16 min-h-[500px] sm:min-h-[560px] flex flex-col justify-between">
        
        {/* Content Box (Left Column) */}
        <div className="max-w-xl lg:max-w-2xl space-y-4 sm:space-y-6">
          
          {/* Eyebrow / Category Tag */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs font-mono text-[var(--color-ink-dim)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6A00] animate-pulse" />
            <span>{activeSlide.eyebrow}</span>
            {activeSlide.badge && (
              <>
                <span className="text-[var(--color-line)]">|</span>
                <span className="text-[#FF6A00] font-semibold">{activeSlide.badge}</span>
              </>
            )}
          </div>

          {/* Headline: Orihost Style Bold White + Orange Italic */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.02]">
            {activeSlide.titlePrefix} <br className="hidden sm:inline" />
            <span className="italic text-[#FF6A00] font-sans font-black inline-block mt-1">
              {activeSlide.titleAccent}
            </span>
          </h1>

          {/* Subtitle / Description */}
          <p className="text-sm sm:text-base text-[var(--color-ink-dim)] leading-relaxed max-w-lg font-normal">
            {activeSlide.description}
          </p>

          {/* Pricing Row: "Starts at €1.00 /mo" */}
          <div className="pt-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-ink-mute)] mb-0.5">
              Starts at
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-5xl font-black text-white font-mono tracking-tight">
                {activeSlide.price}
              </span>
              <span className="text-sm text-[var(--color-ink-mute)] font-mono">
                {activeSlide.period}
              </span>
            </div>
          </div>

          {/* CTAs matching Orihost screenshots */}
          <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('deploy', { category: activeSlide.primaryCtaCategory || activeSlide.category })}
              className="btn btn-primary h-11 px-7 text-sm font-bold shadow-none cursor-pointer bg-[#FF6A00] hover:bg-[#E85D00] text-[#0B0B0C] border-none"
            >
              <span>{activeSlide.primaryCtaText}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSecondaryClick(activeSlide.secondaryCtaTarget, activeSlide.category)}
              className="btn h-11 px-6 text-sm border border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-white font-medium cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{activeSlide.secondaryCtaText}</span>
              <ArrowRight className="h-4 w-4 text-[var(--color-ink-mute)]" />
            </button>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            3. BOTTOM SERVICE TABS BAR (ORPHOST STYLE BOTTOM TABS)
        ───────────────────────────────────────────────────────────────────────────── */}
        <div className="pt-10 sm:pt-14 border-t border-[var(--color-line)]/80 mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Service Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-1">
            {slides.map((s, idx) => {
              const isActive = idx === currentIndex;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleTabClick(idx, s.category)}
                  className={`relative px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                    isActive
                      ? 'text-white bg-[var(--color-surface-2)] border border-[var(--color-line)]'
                      : 'text-[var(--color-ink-mute)] hover:text-white hover:bg-[var(--color-surface)] border border-transparent'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#FF6A00]' : 'text-[var(--color-ink-mute)]'}`} />
                  <span>{s.tabLabel}</span>

                  {/* Active Orange Underline Indicator */}
                  {isActive && (
                    <span
                      className="absolute -bottom-[9px] left-2 right-2 h-[2px] bg-[#FF6A00] rounded-full transition-all"
                      style={{ boxShadow: '0 0 10px rgba(255, 106, 0, 0.7)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Controls: Prev / Next / Pause */}
          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink-mute)] hover:text-white transition-colors cursor-pointer"
              aria-label="Previous slide"
              title="Previous slide (Left Arrow)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsPaused(p => !p)}
              className="p-1.5 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink-mute)] hover:text-white transition-colors cursor-pointer"
              aria-label={isPaused ? 'Resume autoplay' : 'Pause autoplay'}
              title={isPaused ? 'Resume autoplay' : 'Pause autoplay'}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-[#FF6A00]" /> : <Pause className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-md bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink-mute)] hover:text-white transition-colors cursor-pointer"
              aria-label="Next slide"
              title="Next slide (Right Arrow)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
