import React from 'react';

interface MarqueeProps {
  children: React.ReactNode;
  speed?: number; // duration in seconds, default 34
  className?: string;
}

export const Marquee: React.FC<MarqueeProps> = ({ children, speed = 34, className = '' }) => {
  return (
    <div
      className={`marquee ${className}`}
      style={{ '--marquee-speed': `${speed}s` } as React.CSSProperties}
    >
      <div className="marquee__track">
        <div className="flex shrink-0 items-center gap-8 pr-8">
          {children}
        </div>
        <div className="flex shrink-0 items-center gap-8 pr-8" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
};
