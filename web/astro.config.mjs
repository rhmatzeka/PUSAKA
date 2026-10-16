import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/** Dev server meniru rewrite vercel.json: `/i/<token>` dilayani halaman `/i/`. */
const rewriteIjazah = {
  name: 'pusaka-rewrite-ijazah',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/i\/\d+\/?(\?.*)?$/.test(req.url)) req.url = '/i/';
      next();
    });
  },
};

export default defineConfig({
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), rewriteIjazah],
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  },
});
