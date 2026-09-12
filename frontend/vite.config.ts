import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    (cesium as unknown as (options?: Record<string, unknown>) => Plugin)({
      cesiumBaseUrl: 'cesium/',
    }),
  ],
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
