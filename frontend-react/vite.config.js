import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Change the target here to change websocket target
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8001',
        ws: true,
      },
    },
  },
})
