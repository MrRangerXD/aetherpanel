import React from 'react';

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
  if (variant === 'compact') {
    return (
      <div 
        onClick={onClick} 
        className={`inline-flex items-center cursor-pointer select-none group ${className}`}
      >
        <div className="relative flex items-center justify-center p-1.5 rounded-xl bg-zinc-900 border border-amber-500/30 group-hover:border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.15)] transition-all">
          <svg className="w-7 h-7" viewBox="0 0 60 60" fill="none">
            <defs>
              <linearGradient id="compactLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#fbbf24" />
                <stop offset="80%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            <path d="M30 10 L50 21 V43 L30 54 L10 43 V21 Z" fill="none" stroke="url(#compactLogoGrad)" strokeWidth="3" strokeLinejoin="round" />
            <path d="M30 17 L42 28 L37 46 L30 40 L23 46 L18 28 Z" fill="url(#compactLogoGrad)" />
            <circle cx="30" cy="30" r="4" fill="#09090b" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick} 
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none group ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div className="relative flex items-center justify-center p-1.5 rounded-xl bg-zinc-900 border border-amber-500/30 group-hover:border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all">
        <svg className="w-7 h-7" viewBox="0 0 60 60" fill="none">
          <defs>
            <linearGradient id="fullLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#fbbf24" />
              <stop offset="80%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path d="M30 10 L50 21 V43 L30 54 L10 43 V21 Z" fill="none" stroke="url(#fullLogoGrad)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M30 17 L42 28 L37 46 L30 40 L23 46 L18 28 Z" fill="url(#fullLogoGrad)" />
          <circle cx="30" cy="30" r="4" fill="#09090b" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight text-white font-sans flex items-center gap-0.5">
          Aether<span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">Panel</span>
        </span>
        <span className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mt-0.5 font-mono">
          CLOUD INFRASTRUCTURE
        </span>
      </div>
    </div>
  );
};
