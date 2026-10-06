# Gify

Turn short videos into GIFs, right in your browser. Your video never leaves your device.

> Work in progress.

## Stack

React, TypeScript, Vite and Tailwind CSS. Conversion runs on [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), which is FFmpeg compiled to WebAssembly.

## Running locally

```sh
npm install
npm run dev
```

| Command          | What it does                    |
| ---------------- | ------------------------------- |
| `npm run dev`    | Start the dev server            |
| `npm run build`  | Type-check and build to `dist/` |
| `npm run lint`   | Lint with Oxlint                |
| `npm run format` | Format with Prettier            |
