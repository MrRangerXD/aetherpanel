import React, { useEffect, useRef } from 'react';

export const CustomCursor: React.FC = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only activate for fine pointer devices (mouse) and not touch-only devices
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const isTouchOnly = 'ontouchstart' in window && navigator.maxTouchPoints > 0 && !isFinePointer;
    if (!isFinePointer || isTouchOnly) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('custom-cursor-active');

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isMouseDown = false;
    let isHovering = false;
    let isVisible = false;
    let animId: number;

    const lerpFactor = prefersReducedMotion ? 1 : 0.16;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) {
        isVisible = true;
        if (prefersReducedMotion) {
          ringX = mouseX;
          ringY = mouseY;
        }
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
        dotRef.current.style.opacity = isHovering ? '0.3' : '1';
      }
    };

    const handleMouseDown = () => {
      isMouseDown = true;
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    const handleMouseLeave = () => {
      isVisible = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };

    const handleMouseEnter = () => {
      isVisible = true;
      if (dotRef.current) dotRef.current.style.opacity = isHovering ? '0.3' : '1';
      if (ringRef.current) ringRef.current.style.opacity = '1';
    };

    const handleTouchStart = () => {
      document.documentElement.classList.remove('custom-cursor-active');
      isVisible = false;
      if (dotRef.current) dotRef.current.style.display = 'none';
      if (ringRef.current) ringRef.current.style.display = 'none';
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    const checkHover = (x: number, y: number) => {
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
      const el = document.elementFromPoint(x, y);
      if (!el) return false;
      return Boolean(
        el.closest('a, button, [role="button"], input, select, textarea, [data-cursor="hover"]')
      );
    };

    const tick = () => {
      if (isVisible) {
        if (prefersReducedMotion) {
          ringX = mouseX;
          ringY = mouseY;
        } else {
          ringX += (mouseX - ringX) * lerpFactor;
          ringY += (mouseY - ringY) * lerpFactor;
        }

        isHovering = checkHover(mouseX, mouseY);

        let size = 28;
        if (isMouseDown) {
          size = 20;
        } else if (isHovering) {
          size = 44;
        }

        if (ringRef.current) {
          ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
          ringRef.current.style.width = `${size}px`;
          ringRef.current.style.height = `${size}px`;
          ringRef.current.style.opacity = '1';
        }

        if (dotRef.current) {
          dotRef.current.style.opacity = isHovering ? '0.3' : '1';
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
  }, []);

  return (
    <>
      {/* Layer 1: 6px solid dot, exact pointer tracking */}
      <div
        ref={dotRef}
        aria-hidden="true"
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full bg-white pointer-events-none z-[9999] opacity-0 transition-opacity duration-100 ease-linear"
        style={{
          mixBlendMode: 'difference',
          willChange: 'transform, opacity'
        }}
      />
      {/* Layer 2: 28px/44px/20px 1px-bordered ring, follows with soft lerp */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="fixed top-0 left-0 rounded-full border border-white pointer-events-none z-[9999] opacity-0 transition-[width,height] duration-120"
        style={{
          width: '28px',
          height: '28px',
          mixBlendMode: 'difference',
          willChange: 'transform, width, height, opacity',
          transitionTimingFunction: 'var(--ease)'
        }}
      />
    </>
  );
};
