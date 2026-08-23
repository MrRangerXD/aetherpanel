import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/ThemeContext';

export const CustomCursor: React.FC = () => {
  const { customCursorEnabled } = useTheme();
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<HTMLDivElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [cursorType, setCursorType] = useState<'default' | 'text' | 'disabled' | 'link'>('default');

  useEffect(() => {
    // Detect mobile touch vs fine pointers (mouse) and check prefers-reduced-motion
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!hasFinePointer || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouchDevice(true);
      return;
    }

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

    // Smooth lerp for outer ring using requestAnimationFrame
    const render = () => {
      // If prefersReducedMotion is active, bypass smooth lerping to reduce transitions
      const lerpFactor = prefersReducedMotion ? 1.0 : 0.15;
      ringX += (mouseX - ringX) * lerpFactor;
      ringY += (mouseY - ringY) * lerpFactor;

      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      }

      animId = requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });

    animId = requestAnimationFrame(render);

    return () => {
      document.documentElement.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animId);
    };
  }, [customCursorEnabled]);

  if (isTouchDevice || !customCursorEnabled) {
    return null;
  }

  // Determine styling based on type and click state
  let dotClassName = "fixed top-0 left-0 rounded-full pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
  let ringClassName = "fixed top-0 left-0 rounded-full pointer-events-none z-[9998] -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-out border";

  if (cursorType === 'text') {
    // Text input cursor: small vertical line, outer ring hidden/shrunk
    dotClassName += " w-1 h-4 bg-amber-400 rounded-none shadow-[0_0_4px_rgba(245,158,11,0.6)]";
    ringClassName += " w-0 h-0 border-transparent bg-transparent scale-0";
  } else if (cursorType === 'disabled') {
    // Disabled state: greyed out, strike-through look or just small grey dot
    dotClassName += " w-2 h-2 bg-zinc-600 shadow-none";
    ringClassName += " w-6 h-6 border-zinc-700 bg-zinc-800/20";
  } else if (cursorType === 'link') {
    // Link/Button hover state: expanded outer ring with premium glow, slightly larger dot
    dotClassName += " w-3 h-3 bg-amber-300";
    ringClassName += " w-11 h-11 border-amber-400 bg-amber-500/10 scale-110 shadow-[0_0_12px_rgba(245,158,11,0.2)]";
  } else {
    // Default pointer state
    dotClassName += " w-2 h-2 bg-amber-400";
    ringClassName += isMouseDown
      ? " w-6 h-6 border-amber-300 bg-amber-400/20 scale-90"
      : " w-8 h-8 border-amber-500/30 bg-amber-500/5";
  }

  return (
    <>
      {/* Central Pointer Dot */}
      <div
        ref={cursorDotRef}
        className={dotClassName}
        style={{ willChange: 'transform' }}
      />

      {/* Smooth Outer Aura Ring */}
      <div
        ref={cursorRingRef}
        className={ringClassName}
        style={{ willChange: 'transform' }}
      />
    </>
  );
};

