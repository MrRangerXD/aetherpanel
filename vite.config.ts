import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const allowedHostsEnv = process.env.VITE_ALLOWED_HOSTS || process.env.ALLOWED_HOSTS;
  const allowedHosts: true | string[] = allowedHostsEnv
    ? allowedHostsEnv.split(',').map(h => h.trim())
    : true;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts,
      // HMR is disabled in this environment to prevent port 24678 WebSocket conflicts
      hmr: false as const,
      ws: false as const,
    },
  };
});
