import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundling breaks the worker that ffmpeg.wasm spawns.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  // ffmpeg.wasm starts its worker as a module and loads the core with import().
  worker: { format: 'es' },
})
