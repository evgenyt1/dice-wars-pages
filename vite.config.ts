import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dice-wars-pages/',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
});
