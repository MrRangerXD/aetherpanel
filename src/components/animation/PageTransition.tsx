import React from 'react';
import { motion } from 'motion/react';
import { useAnimation } from '../../lib/AnimationContext';

interface PageTransitionProps {
  routeKey: string;
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ routeKey, children }) => {
  const { motionEnabled } = useAnimation();

  if (!motionEnabled) {
    return <div className="w-full h-full flex flex-col flex-1">{children}</div>;
  }

  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 12, scale: 0.998 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.998 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
      className="w-full h-full flex flex-col flex-1"
    >
      {children}
    </motion.div>
  );
};
