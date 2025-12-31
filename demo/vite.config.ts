import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Use built library for demo (simulates real usage)
      playmaker: resolve(__dirname, '../dist/playmaker.js'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
