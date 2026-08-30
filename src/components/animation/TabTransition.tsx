import React from 'react';
import { motion } from 'motion/react';
import { useAnimation } from '../../lib/AnimationContext';

interface TabTransitionProps {
  children: React.ReactNode;
}

export const TabTransition: React.FC<TabTransitionProps> = ({ children }) => {
  const { getTransitionProps } = useAnimation();
  const props = getTransitionProps('tab');

  return (
    <motion.div
      initial={props.initial}
      animate={props.animate}
      exit={props.exit}
      transition={props.transition}
      className="w-full"
    >
      {children}
    </motion.div>
  );
};
