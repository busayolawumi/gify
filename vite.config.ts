import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Multi-threaded ffmpeg.wasm needs SharedArrayBuffer, which browsers only
// allow on cross-origin isolated pages. vercel.json sets these in production.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundling breaks the worker that ffmpeg.wasm spawns.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
})
