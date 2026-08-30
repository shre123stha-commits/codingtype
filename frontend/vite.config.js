import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    fs: {
      allow: [path.resolve(here, '..')]
    },
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    // Production source maps are OFF by default (they expose the source code
    // to anyone who downloads the bundle). Opt in per build when debugging:
    //   VITE_SOURCEMAPS=1 npm run build
    sourcemap: process.env.VITE_SOURCEMAPS === '1',
    chunkSizeWarningLimit: 900
  }
});
