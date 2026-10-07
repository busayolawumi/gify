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
  // `ratio` is set while the engine is still downloading (first visit).
  | { stage: 'loading'; ratio?: number }
  | { stage: 'analysing' }
  | { stage: 'encoding'; ratio: number }

/** Why a conversion failed, so the UI can say something useful. */
export type ConvertErrorKind = 'network' | 'memory' | 'unreadable' | 'unknown'

export class ConvertError extends Error {
  kind: ConvertErrorKind
  constructor(kind: ConvertErrorKind, cause: unknown) {
    super(`Couldn't make the GIF (${kind})`, { cause })
    this.kind = kind
  }
}

// Matched against error messages and FFmpeg's last log lines.
const MEMORY_ERRORS =
  /out of memory|\bOOM\b|Cannot enlarge memory|memory access out of bounds|Array buffer allocation failed|could not allocate memory/i
const UNREADABLE_ERRORS =
  /Invalid data found|could not find codec parameters|Decoder .{0,40}not found|moov atom not found|does not contain any stream|matches no streams|Error while decoding/i

function kindOf(error: unknown, fallback: ConvertErrorKind): ConvertErrorKind {
  const text = error instanceof Error ? error.message : String(error)
  if (MEMORY_ERRORS.test(text)) return 'memory'
  if (UNREADABLE_ERRORS.test(text)) return 'unreadable'
  return fallback
}

const INPUT = 'input'
const PALETTE = 'palette.png'
const OUTPUT = 'output.gif'
// Separate names, so reading a video's length can't clash with a conversion.
const PROBE_INPUT = 'probe-input'
const PROBE_OUTPUT = 'probe.txt'

let engine: Promise<FFmpeg> | undefined
let engineReady = false
// How much of the engine has downloaded (0–1), and who wants to know.
let downloaded = 0
const downloadListeners = new Set<(ratio: number) => void>()

/** Downloads a file, reporting progress against its known size. */
async function download(
  url: string,
  size: number,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}): ${url}`)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress(Math.min(received / size, 1))
  }
  return new Blob(chunks, { type: 'application/wasm' })
}

// The core is ~32MB, so it's only downloaded once a video has been chosen.
// It's the single-threaded core on purpose: the multi-threaded one deadlocks
// on iPhone (HEVC) videos, so conversions would hang forever. See CLAUDE.md.
function loadEngine() {
  if (!engine) {
    engine = (async () => {
      const ffmpeg = new FFmpeg()
      if (import.meta.env.DEV) {
        // FFmpeg's own output, under "Verbose" in the browser console.
        ffmpeg.on('log', ({ message }) => console.debug('[ffmpeg]', message))
      }
      // Download the engine ourselves to show progress, then hand it to
      // FFmpeg as a blob URL. After the first visit it comes from the cache.
      let lastPercent = -1
      const wasm = await download(wasmURL, __ENGINE_WASM_SIZE__, (ratio) => {
        downloaded = ratio
        const percent = Math.floor(ratio * 100)
        if (percent === lastPercent) return
        lastPercent = percent
        downloadListeners.forEach((listener) => listener(ratio))
      })
      const wasmBlobURL = URL.createObjectURL(wasm)
      try {
        await ffmpeg.load({ coreURL, wasmURL: wasmBlobURL })
      } finally {
        URL.revokeObjectURL(wasmBlobURL)
      }
      engineReady = true
      return ffmpeg
    })()
    // Let the next conversion try again if this load failed.
    engine.catch(() => {
      engine = undefined
      downloaded = 0
    })
  }
  return engine
}

// Shuts the engine down and starts loading a fresh one. Needed after a
// cancel, because FFmpeg can't be stopped mid-run, and after a crash, which
// can leave it unusable.
function resetEngine(ffmpeg: FFmpeg) {
  ffmpeg.terminate()
  engine = undefined
  engineReady = false
  downloaded = 0
  preloadEngine()
}

/** Starts downloading the engine early, so it's ready by the time it's needed. */
export function preloadEngine() {
  // A failure here shows up on the next conversion, which tries again.
  loadEngine().catch(() => {})
}

/** Reads a video's length with FFmpeg, for videos the browser can't open. */
export async function getDuration(file: File): Promise<number> {
  const ffmpeg = await loadEngine()
  try {
    await ffmpeg.writeFile(PROBE_INPUT, await fetchFile(file))
    const code = await ffmpeg.ffprobe([
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      PROBE_INPUT,
      '-o',
      PROBE_OUTPUT,
    ])
    const text = String(await ffmpeg.readFile(PROBE_OUTPUT, 'utf8'))
    const seconds = parseFloat(text)
    if (code !== 0 || !(seconds > 0)) {
      throw new Error(
        `ffprobe couldn't read a duration (exit ${code}): ${text}`,
      )
    }
    return seconds
  } finally {
    await Promise.allSettled(
      [PROBE_INPUT, PROBE_OUTPUT].map((path) => ffmpeg.deleteFile(path)),
    )
  }
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

/**
 * Makes a GIF from part of a video. Aborting `signal` cancels it, and the
 * promise then rejects with the signal's reason. Other failures reject with
 * a ConvertError that says what kind of problem it was.
 */
export async function convert(
  file: File,
  options: ConvertOptions,
  onProgress?: (progress: ConvertProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  signal?.throwIfAborted()
  // On a first visit the engine may still be downloading, so pass on its
  // progress while waiting for it.
  const reportDownload = (ratio: number) =>
    onProgress?.({ stage: 'loading', ratio })
  if (!engineReady) {
    reportDownload(downloaded)
    downloadListeners.add(reportDownload)
  }
  let ffmpeg: FFmpeg
  try {
    ffmpeg = await loadEngine()
  } catch (e) {
    console.error(e)
    throw new ConvertError(kindOf(e, 'network'), e)
  } finally {
    downloadListeners.delete(reportDownload)
  }
  signal?.throwIfAborted()
  // Downloaded. Now copying the video in, which takes a moment for big files.
  onProgress?.({ stage: 'loading' })

  const stop = () => resetEngine(ffmpeg)
  signal?.addEventListener('abort', stop, { once: true })

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
  } catch (e) {
    // Shutting the engine down makes its unfinished work fail. Report that as
    // the cancel it really was.
    if (signal?.aborted) throw signal.reason
    const kind = kindOf(e, 'unknown')
    // FFmpeg turning a video down is a normal exit, and the engine is fine.
    // Anything else may have broken it, so start a fresh one.
    if (kind !== 'unreadable') resetEngine(ffmpeg)
    throw new ConvertError(kind, e)
  } finally {
    signal?.removeEventListener('abort', stop)
    ffmpeg.off('progress', reportEncoding)
    // Free the memory these take up inside ffmpeg.wasm. If the engine was shut
    // down (cancel or crash), it's all gone already.
    if (ffmpeg.loaded) {
      await Promise.allSettled(
        [INPUT, PALETTE, OUTPUT].map((path) => ffmpeg.deleteFile(path)),
      )
    }
  }
}
