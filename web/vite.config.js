import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Backend origin used by the dev server to proxy API calls.
const API_TARGET = process.env.API_TARGET || 'http://localhost:8000'
const API_PATHS = ['/servers', '/status', '/history', '/availability', '/push', '/set-expiry', '/set-purchase-date', '/login', '/logout', '/doodle', '/geo']

export default defineConfig({
  root: '.',
  base: '/',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'index.html'),
        detail: resolve(__dirname, 'detail.html'),
        login: resolve(__dirname, 'login.html'),
      },
    },
  },
  server: {
    proxy: Object.fromEntries(API_PATHS.map((p) => [p, { target: API_TARGET, changeOrigin: true }])),
  },
})
