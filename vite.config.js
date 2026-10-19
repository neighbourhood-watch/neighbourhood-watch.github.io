import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'development-style-policy',
    transformIndexHtml(html, context) {
      return context.server ? html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'") : html;
    },
  }],
  build: { rollupOptions: { input: { index: resolve(import.meta.dirname, 'index.html'), admin: resolve(import.meta.dirname, 'admin.html') } } },
});