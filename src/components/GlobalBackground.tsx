import React from 'react';

interface GlobalBackgroundProps {
  isPanel?: boolean;
}

export const GlobalBackground: React.FC<GlobalBackgroundProps> = ({ isPanel = false }) => {
  return (
    <div
      id="aether-wallpaper-layer"
      aria-hidden="true"
      className="fixed inset-0 -z-10 bg-[var(--color-bg)] pointer-events-none select-none"
    />
  );
};
