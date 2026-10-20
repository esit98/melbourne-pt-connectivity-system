import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_PUBLICATION_MODE === 'static' ? '/melbourne-pt-connectivity-dashboard/' : '/',
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 5174, strictPort: true },
});
