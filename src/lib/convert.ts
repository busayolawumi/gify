import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

export type ConvertOptions = {
  /** Where the clip starts, in seconds. */
  start: number
  /** Where the clip ends, in seconds. */
  end: number
  /**
   * Length of the longer side in pixels, so portrait and landscape videos
   * come out the same size. Smaller videos are not scaled up.
   */
  size: number
  fps: number
}

export type ConvertProgress =
  | { stage: 'loading' }
  | { stage: 'analysing' }
  | { stage: 'encoding'; ratio: number }

const INPUT = 'input'
const PALETTE = 'palette.png'
const OUTPUT = 'output.gif'

let engine: Promise<FFmpeg> | undefined

// The core is ~32MB, so it's only downloaded on the first conversion. It's the
// single-threaded core on purpose: the multi-threaded one deadlocks on iPhone
// (HEVC) videos, so conversions would hang forever. See CLAUDE.md.
function loadEngine() {
  if (!engine) {
    engine = (async () => {
      const ffmpeg = new FFmpeg()
      if (import.meta.env.DEV) {
        // FFmpeg's own output, under "Verbose" in the browser console.
        ffmpeg.on('log', ({ message }) => console.debug('[ffmpeg]', message))
      }
      await ffmpeg.load({ coreURL, wasmURL })
      return ffmpeg
    })()
    // Let the next conversion try again if this load failed.
    engine.catch(() => (engine = undefined))
  }
  return engine
}

async function run(ffmpeg: FFmpeg, args: string[]) {
  const logs: string[] = []
  const collect = ({ message }: { message: string }) => logs.push(message)
  ffmpeg.on('log', collect)
  try {
    const code = await ffmpeg.exec(args)
    if (code !== 0) {
      throw new Error(
        `ffmpeg exited with ${code}:\n${logs.slice(-15).join('\n')}`,
      )
    }
  } finally {
    ffmpeg.off('log', collect)
  }
}

export async function convert(
  file: File,
  options: ConvertOptions,
  onProgress?: (progress: ConvertProgress) => void,
): Promise<Blob> {
  onProgress?.({ stage: 'loading' })
  const ffmpeg = await loadEngine()

  const { start, end, size, fps } = options
  const duration = end - start
  // -ss before -i seeks quickly and makes the clip's timestamps start at 0.
  const input = [
    '-ss',
    start.toFixed(3),
    '-t',
    duration.toFixed(3),
    '-i',
    INPUT,
  ]
  // Fit inside a size×size box, keeping the aspect ratio.
  const filters = `fps=${fps},scale='min(${size},iw)':'min(${size},ih)':force_original_aspect_ratio=decrease:flags=lanczos`
  // -map_metadata -1 drops everything copied from the video, such as the
  // phone model and the GPS location, so a GIF can never carry them.
  const output = ['-map_metadata', '-1', '-loop', '0', OUTPUT]

  // `time` is how much of the GIF has been written, in microseconds.
  const reportEncoding = ({ time }: { time: number }) => {
    const ratio = Math.min(Math.max(time / (duration * 1e6), 0), 1)
    onProgress?.({ stage: 'encoding', ratio })
  }

  try {
    await ffmpeg.writeFile(INPUT, await fetchFile(file))

    // Two passes: the first builds a palette from the clip's own colours, and
    // the second uses it. Doing it in one pass would hold every frame in
    // memory, which phones can't afford. The first pass only writes one frame
    // at the very end, so it has no useful progress to report.
    onProgress?.({ stage: 'analysing' })
    await run(ffmpeg, [
      ...input,
      '-vf',
      `${filters},palettegen=stats_mode=diff`,
      PALETTE,
    ])

    onProgress?.({ stage: 'encoding', ratio: 0 })
    ffmpeg.on('progress', reportEncoding)
    await run(ffmpeg, [
      ...input,
      '-i',
      PALETTE,
      '-lavfi',
      // Pattern (bayer) dithering hides colour banding on camera footage and
      // stays stable between frames. diff_mode=rectangle only re-encodes the
      // part of each frame that changed.
      `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      ...output,
    ])

    const data = (await ffmpeg.readFile(OUTPUT)) as Uint8Array<ArrayBuffer>
    return new Blob([data], { type: 'image/gif' })
  } finally {
    ffmpeg.off('progress', reportEncoding)
    // Free the memory these take up inside ffmpeg.wasm.
    await Promise.allSettled(
      [INPUT, PALETTE, OUTPUT].map((path) => ffmpeg.deleteFile(path)),
    )
  }
}
