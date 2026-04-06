import { defineConfig } from 'vite';
import { setupRyuuProxy } from './setupProxy.js';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  plugins: [
    {
      name: 'ryuu-proxy-middleware',
      configureServer: setupRyuuProxy,
    },
  ],
});
