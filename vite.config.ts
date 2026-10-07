import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The engine's real size, for the first-visit download percentage. Vercel
// compresses the file on the way, so the download itself doesn't say how big
// it is.
const engineWasmSize = statSync(
  fileURLToPath(import.meta.resolve('@ffmpeg/core/wasm')),
).size

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __ENGINE_WASM_SIZE__: JSON.stringify(engineWasmSize),
  },
  // Pre-bundling breaks the worker that ffmpeg.wasm spawns.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  // ffmpeg.wasm starts its worker as a module and loads the core with import().
  worker: { format: 'es' },
})
