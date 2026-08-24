import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/ThemeContext';

export const CustomCursor: React.FC = () => {
  const { customCursorEnabled } = useTheme();
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const cursorAuraRef = useRef<HTMLDivElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [cursorType, setCursorType] = useState<'default' | 'text' | 'disabled' | 'link'>('default');

  useEffect(() => {
    // Detect fine pointer (mouse/trackpad) vs coarse-only touch device
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // If device doesn't support fine pointer, it's a touch-only mobile/tablet device
    if (!hasFinePointer) {
      setIsTouchDevice(true);
      return;
    }

    setIsTouchDevice(false);

    // Apply global cursor hiding class
    if (customCursorEnabled) {
      document.documentElement.classList.add('custom-cursor-active');
    } else {
      document.documentElement.classList.remove('custom-cursor-active');
    }

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let auraX = -100;
    let auraY = -100;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }

      // Check if target is clickable or input
      const target = e.target as HTMLElement | null;
      if (target) {
        const isInput = !!(
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.contentEditable === 'true' ||
          target.closest('[contenteditable="true"]')
        );

        const isDisabled = !!(
          target.hasAttribute('disabled') ||
          target.closest('[disabled]') ||
          target.classList.contains('opacity-50')
        );

        const isLinkOrBtn = !!(
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.closest('button') ||
          target.closest('a') ||
          target.closest('[role="button"]') ||
          target.classList.contains('clickable')
        );

        if (isDisabled) {
          setCursorType('disabled');
          setIsHovered(false);
        } else if (isInput) {
          setCursorType('text');
          setIsHovered(false);
        } else if (isLinkOrBtn) {
          setCursorType('link');
          setIsHovered(true);
        } else {
          setCursorType('default');
          setIsHovered(false);
        }
      }
    };

    const handleMouseDown = () => setIsMouseDown(true);
    const handleMouseUp = () => setIsMouseDown(false);
    const handleMouseLeave = () => {
      if (cursorDotRef.current) cursorDotRef.current.style.opacity = '0';
      if (cursorRingRef.current) cursorRingRef.current.style.opacity = '0';
      if (cursorAuraRef.current) cursorAuraRef.current.style.opacity = '0';
    };
    const handleMouseEnter = () => {
      if (cursorDotRef.current) cursorDotRef.current.style.opacity = '1';
      if (cursorRingRef.current) cursorRingRef.current.style.opacity = '1';
      if (cursorAuraRef.current) cursorAuraRef.current.style.opacity = '1';
    };

    // Smooth lerp for outer ring and aura using requestAnimationFrame
    const render = () => {
      const lerpFactor = prefersReducedMotion ? 1.0 : 0.18;
      const auraLerpFactor = prefersReducedMotion ? 1.0 : 0.09;

      ringX += (mouseX - ringX) * lerpFactor;
      ringY += (mouseY - ringY) * lerpFactor;
      auraX += (mouseX - auraX) * auraLerpFactor;
      auraY += (mouseY - auraY) * auraLerpFactor;

      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }
      if (cursorAuraRef.current) {
        cursorAuraRef.current.style.transform = `translate3d(${auraX}px, ${auraY}px, 0)`;
      }

      animId = requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    animId = requestAnimationFrame(render);

    return () => {
      document.documentElement.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(animId);
    };
  }, [customCursorEnabled]);

  if (isTouchDevice || !customCursorEnabled) {
    return null;
  }

  // Determine styling based on type and click state
  let pointerContainerClass = "fixed top-0 left-0 pointer-events-none z-[9999] transition-opacity duration-150";
  let ringClassName = "fixed top-0 left-0 rounded-full pointer-events-none z-[9998] -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-out border";
  let auraClassName = "fixed top-0 left-0 rounded-full pointer-events-none z-[9997] -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out";

  if (cursorType === 'text') {
    // Text input cursor: small vertical line, outer ring hidden/shrunk
    ringClassName += " w-0 h-0 border-transparent bg-transparent scale-0 opacity-0";
    auraClassName += " w-0 h-0 opacity-0 scale-0";
  } else if (cursorType === 'disabled') {
    // Disabled state: greyed out
    ringClassName += " w-6 h-6 border-zinc-700 bg-zinc-800/20 opacity-50";
    auraClassName += " w-8 h-8 opacity-0";
  } else if (cursorType === 'link') {
    // Link/Button hover state: expanded outer ring with premium glow
    ringClassName += " w-11 h-11 border-amber-400/90 bg-amber-500/10 scale-110 shadow-[0_0_16px_rgba(245,158,11,0.4)]";
    auraClassName += " w-16 h-16 bg-amber-400/15 blur-md scale-125 opacity-100";
  } else {
    // Default pointer state
    ringClassName += isMouseDown
      ? " w-6 h-6 border-amber-300 bg-amber-400/25 scale-90 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
      : " w-8 h-8 border-amber-500/40 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.2)]";
    auraClassName += isMouseDown
      ? " w-10 h-10 bg-amber-400/20 blur-sm opacity-90"
      : " w-12 h-12 bg-amber-500/15 blur-sm opacity-70";
  }

  return (
    <>
      {/* Outer Glow Aura Layer */}
      <div
        ref={cursorAuraRef}
        className={auraClassName}
        style={{ willChange: 'transform' }}
      />

      {/* Primary Golden Pointer (Sharp Arrow / I-Beam / Disabled) */}
      <div
        ref={cursorDotRef}
        className={pointerContainerClass}
        style={{ willChange: 'transform' }}
      >
        {cursorType === 'text' ? (
          <div className="w-1 h-5 bg-amber-400 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
        ) : cursorType === 'disabled' ? (
          <div className="w-3 h-3 bg-zinc-500 rounded-full -translate-x-1/2 -translate-y-1/2 border border-zinc-400 shadow-sm opacity-80" />
        ) : (
          <div className={`transition-transform duration-75 origin-top-left ${isMouseDown ? 'scale-90' : 'scale-100'}`}>
            <svg
              width="22"
              height="26"
              viewBox="0 0 22 26"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_0_10px_rgba(245,158,11,0.85)]"
            >
              <path
                d="M 1 1 L 20 12 L 11.5 14.5 L 16 23.5 L 12 25.5 L 7.5 16.5 L 1 20.5 Z"
                fill="url(#gold-cursor-grad)"
                stroke="#F59E0B"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="gold-cursor-grad" x1="0" y1="0" x2="22" y2="26" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="45%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        )}
      </div>

      {/* Smooth Outer Ring Reticle */}
      <div
        ref={cursorRingRef}
        className={ringClassName}
        style={{ willChange: 'transform' }}
      />
    </>
  );
};


