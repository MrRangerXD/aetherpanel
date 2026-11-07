import React from 'react';
import { motion } from 'motion/react';
import { useAnimation } from '../../lib/AnimationContext';

interface TabTransitionProps {
  children: React.ReactNode;
}

export const TabTransition: React.FC<TabTransitionProps> = ({ children }) => {
  const { getTransitionProps, motionEnabled } = useAnimation();
  const props = getTransitionProps('tab');

  if (!motionEnabled) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.998 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.998 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};
