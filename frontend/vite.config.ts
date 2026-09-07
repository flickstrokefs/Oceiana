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
  },
});
