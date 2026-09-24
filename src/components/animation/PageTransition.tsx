import React from 'react';
import { motion } from 'motion/react';
import { useAnimation } from '../../lib/AnimationContext';

interface PageTransitionProps {
  routeKey: string;
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ routeKey, children }) => {
  const { getTransitionProps, motionEnabled } = useAnimation();
  const props = getTransitionProps('page');

  if (!motionEnabled) {
    return <div className="w-full h-full flex flex-col flex-1">{children}</div>;
  }

  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="w-full h-full flex flex-col flex-1"
    >
      {children}
    </motion.div>
  );
};
