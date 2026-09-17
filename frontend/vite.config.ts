import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    (cesium as unknown as (options?: Record<string, unknown>) => Plugin)({
      cesiumBaseUrl: 'cesium/',
    }),
    {
      name: 'app-route-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/app' || req.url === '/app/') {
            req.url = '/app.html';
          }
          next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        app: resolve(process.cwd(), 'app.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: false,
    proxy: {
      // Forward Observation Profile + Argo API calls to FastAPI backend
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
