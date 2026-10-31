import React, { useEffect, useRef, useState } from 'react';

export const CustomCursor: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('aether_custom_cursor');
    return stored !== 'false';
  });

  const [cursorType, setCursorType] = useState<'arrow' | 'pointer' | 'text'>('arrow');
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // Listen for custom toggle events from Navbar or Footer
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled?: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setIsEnabled(customEvent.detail.enabled);
        localStorage.setItem('aether_custom_cursor', customEvent.detail.enabled ? 'true' : 'false');
      } else {
        setIsEnabled(prev => {
          const next = !prev;
          localStorage.setItem('aether_custom_cursor', next ? 'true' : 'false');
          return next;
        });
      }
    };

    window.addEventListener('aether-cursor-toggle', handleToggle);
    return () => window.removeEventListener('aether-cursor-toggle', handleToggle);
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      document.documentElement.classList.remove('custom-cursor-active');
      return;
    }

    // Touch device detection
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const isCoarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isFinePointer || isCoarse) {
      document.documentElement.classList.remove('custom-cursor-active');
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('custom-cursor-active');

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let animId: number;

    const lerpFactor = prefersReducedMotion ? 1 : 0.18;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) setIsVisible(true);

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }

      // Check hover target
      const target = e.target as HTMLElement | null;
      if (target) {
        const isTextInput = Boolean(
          target.closest('input[type="text"], input[type="password"], input[type="email"], input[type="search"], textarea, [contenteditable="true"]')
        );
        const isInteractive = Boolean(
          target.closest('a, button, [role="button"], select, .interactive, [data-cursor="hover"], input[type="checkbox"], input[type="radio"]')
        );

        if (isTextInput) {
          setCursorType('text');
        } else if (isInteractive) {
          setCursorType('pointer');
        } else {
          setCursorType('arrow');
        }
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseLeave = () => {
      setIsVisible(false);
      if (cursorRef.current) cursorRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
      if (cursorRef.current) cursorRef.current.style.opacity = '1';
      if (ringRef.current) ringRef.current.style.opacity = '1';
    };

    const handleTouchStart = () => {
      document.documentElement.classList.remove('custom-cursor-active');
      setIsEnabled(false);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    const tick = () => {
      if (isVisible) {
        if (prefersReducedMotion) {
          ringX = mouseX;
          ringY = mouseY;
        } else {
          ringX += (mouseX - ringX) * lerpFactor;
          ringY += (mouseY - ringY) * lerpFactor;
        }

        if (ringRef.current) {
          ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
          ringRef.current.style.opacity = '1';
        }
        if (cursorRef.current) {
          cursorRef.current.style.opacity = '1';
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      document.documentElement.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isEnabled, isVisible]);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Trailing Soft Amber/Orange Ring */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 pointer-events-none z-[99998] transition-[width,height,border-color] duration-150 rounded-full"
        style={{
          width: cursorType === 'pointer' ? '42px' : '28px',
          height: cursorType === 'pointer' ? '42px' : '28px',
          border: '1.5px solid rgba(255, 106, 0, 0.45)',
          backgroundColor: cursorType === 'pointer' ? 'rgba(255, 106, 0, 0.08)' : 'transparent',
          opacity: isVisible ? 1 : 0,
          transform: 'translate3d(-100px, -100px, 0) translate(-50%, -50%)'
        }}
      />

      {/* Layer 1: Real Custom Orange Pointer Cursor (Arrow / Hand / Caret) */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[99999] will-change-transform"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: 'translate3d(-100px, -100px, 0)',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7))'
        }}
      >
        <div
          className={`transition-transform duration-75 ${isClicking ? 'scale-90' : 'scale-100'}`}
          style={{ transformOrigin: 'top left' }}
        >
          {cursorType === 'pointer' ? (
            /* Orange Hand Pointer (matching image_da797376.png) */
            <svg
              width="26"
              height="28"
              viewBox="0 0 24 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="-ml-1 -mt-1"
            >
              {/* Hand Outline & Shading */}
              <path
                d="M8.5 2C7.67 2 7 2.67 7 3.5V12.1L6.14 11.2C5.55 10.6 4.6 10.6 4.02 11.19C3.43 11.77 3.43 12.73 4.02 13.31L9.15 18.45C10.55 19.85 12.45 20.64 14.43 20.64H17C19.76 20.64 22 18.4 22 15.64V9.5C22 8.67 21.33 8 20.5 8C20.3 8 20.12 8.04 19.95 8.11C19.68 7.45 19.04 7 18.29 7C18.06 7 17.84 7.05 17.65 7.15C17.37 6.46 16.7 6 15.93 6C15.77 6 15.61 6.03 15.46 6.08V3.5C15.46 2.67 14.79 2 13.96 2C13.56 2 13.2 2.16 12.93 2.42C12.66 2.16 12.3 2 11.9 2H8.5Z"
                fill="#FF7A00"
                stroke="#6B2900"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              {/* Hand Finger Details & Highlights */}
              <path
                d="M10 5V12M12.5 7V13M15 8V13"
                stroke="#FFA24A"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          ) : cursorType === 'text' ? (
            /* Orange Caret Indicator */
            <div className="flex flex-col items-center -ml-1 -mt-3">
              <div className="w-2.5 h-0.5 bg-[#FF7A00] rounded-full" />
              <div className="w-0.5 h-5 bg-[#FF7A00] my-0.5" />
              <div className="w-2.5 h-0.5 bg-[#FF7A00] rounded-full" />
            </div>
          ) : (
            /* Sharp Orange Arrow Cursor (matching image_da797376.png) */
            <svg
              width="26"
              height="28"
              viewBox="0 0 26 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="-ml-0.5 -mt-0.5"
            >
              {/* Main Arrow Body */}
              <path
                d="M2.5 2.5L10.2 24.8C10.6 25.9 12.1 26.1 12.8 25.1L16.4 19.8L22.8 22.4C23.8 22.8 24.9 22.1 25.1 21L25.3 19.8C25.5 18.8 25 17.8 24 17.4L17.6 14.8L21.4 9.5C22.1 8.5 21.5 7.1 20.3 6.9L2.5 2.5Z"
                fill="#FF6A00"
                stroke="#662600"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              {/* Top Surface Inner Highlight */}
              <path
                d="M4.5 5.5L10 21.5L14.2 15.8L20 8.5L4.5 5.5Z"
                fill="#FFA04D"
                opacity="0.8"
              />
            </svg>
          )}
        </div>
      </div>
    </>
  );
};
