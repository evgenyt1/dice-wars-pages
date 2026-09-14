import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { offlineServiceWorker } from './pwa/vite-plugin';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Static client build for GitHub Pages (evgenyt1/dice-wars-pages). */
export default defineConfig({
  root: here('./gh-pages'),
  base: process.env.PAGES_BASE ?? '/dice-wars-pages/',
  publicDir: here('./public'),
  build: { outDir: here('./dist-pages'), emptyOutDir: true },
  resolve: {
    alias: {
      '@': here('.'),
      'next/image': here('./gh-pages/next-image.tsx'),
    },
  },
  css: { postcss: { plugins: [tailwindcss({ base: here('.') })] } },
  plugins: [react(), offlineServiceWorker()],
});
