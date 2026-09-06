import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const API_TARGET = 'https://elfishawy-cafe-server.vercel.app';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy: في dev mode، الطلبات للـ API بتتوجه عبر Node.js بدل المتصفح مباشرة
      // بيحل مشكلة الـ firewall/antivirus اللي بتبلوك HTTPS requests من المتصفح
      proxy: {
        '/auth': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/product': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/category': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/inventory': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/order': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/recipe': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/user': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/report': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
        '/upload': {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
