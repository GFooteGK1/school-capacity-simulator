import { defineConfig } from 'vite';

export default defineConfig({
  base: '/school-capacity-simulator/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
  },
});
