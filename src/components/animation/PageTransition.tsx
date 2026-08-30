import React from 'react';
import { motion } from 'motion/react';
import { useAnimation } from '../../lib/AnimationContext';

interface PageTransitionProps {
  routeKey: string;
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ routeKey, children }) => {
  const { getTransitionProps } = useAnimation();
  const props = getTransitionProps('page');

  return (
    <motion.div
      key={routeKey}
      initial={props.initial}
      animate={props.animate}
      exit={props.exit}
      transition={props.transition}
      className="w-full h-full flex flex-col flex-1"
    >
      {children}
    </motion.div>
  );
};
