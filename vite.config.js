import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

// Domo ryuu-proxy plugin for local dev — proxies /data/ and /domo/ requests
// to your Domo instance using your CLI login credentials.
// Run "domo login" first if you haven't already.
function domoProxy() {
  return {
    name: 'domo-proxy',
    async configureServer(server) {
      try {
        const { Proxy } = await import('@domoinc/ryuu-proxy');
        const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf-8'));
        const proxy = new Proxy({ manifest });
        server.middlewares.use(proxy.express());
        console.log('\n  Domo proxy active — API calls forwarded to your Domo instance\n');
      } catch (e) {
        console.warn('\n  Domo proxy unavailable:', e.message);
        console.warn('  Run "domo login" to enable local data fetching\n');
      }
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  plugins: [domoProxy()],
});
