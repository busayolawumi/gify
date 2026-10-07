/** How big and how smooth the GIF is. `size` is the longer side in pixels. */
export type Quality = { size: number; fps: number }

export const PRESETS = {
  Small: { size: 320, fps: 10, description: 'Quick to share' },
  Balanced: { size: 480, fps: 15, description: 'Good for most things' },
  High: { size: 720, fps: 20, description: 'Sharpest, biggest file' },
}
export type PresetName = keyof typeof PRESETS | 'Custom'
export const PRESET_NAMES: PresetName[] = [
  'Small',
  'Balanced',
  'High',
  'Custom',
]
export const CUSTOM_DESCRIPTION = 'Set your own'

// Past 1080px GIFs get very slow to make and very large. Past 30fps they
// barely look smoother, and some browsers play very fast GIFs slower.
export const SIZE_RANGE = { min: 160, max: 1080, step: 20 }
export const FPS_RANGE = { min: 5, max: 30, step: 1 }

export type Settings = { preset: PresetName; custom: Quality }

const DEFAULT_SETTINGS: Settings = {
  preset: 'Balanced',
  custom: { size: 600, fps: 20 },
}

export type Dimensions = { width: number; height: number }

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/** The largest custom size for a video: never bigger than the video itself. */
export function maxCustomSize(video?: Dimensions) {
  if (!video) return SIZE_RANGE.max
  const longer = Math.max(video.width, video.height)
  return clamp(longer, SIZE_RANGE.min, SIZE_RANGE.max)
}

export function qualityOf(settings: Settings, video?: Dimensions): Quality {
  if (settings.preset !== 'Custom') {
    const { size, fps } = PRESETS[settings.preset]
    return { size, fps }
  }
  const { size, fps } = settings.custom
  return { size: Math.min(size, maxCustomSize(video)), fps }
}

/**
 * The GIF's real width and height. This must match the scale filter in
 * convert(): fit inside a size×size box, keep the shape, never scale up.
 */
export function outputDimensions(video: Dimensions, size: number): Dimensions {
  const boxWidth = Math.min(size, video.width)
  const boxHeight = Math.min(size, video.height)
  return {
    width: Math.min(
      Math.round((boxHeight * video.width) / video.height),
      boxWidth,
    ),
    height: Math.min(
      Math.round((boxWidth * video.height) / video.width),
      boxHeight,
    ),
  }
}

// The last choice is remembered in this browser only.
const STORAGE_KEY = 'gify:settings'

export function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    const { preset, custom } = saved ?? {}
    if (
      PRESET_NAMES.includes(preset) &&
      Number.isFinite(custom?.size) &&
      Number.isFinite(custom?.fps)
    ) {
      return {
        preset,
        custom: {
          size: clamp(custom.size, SIZE_RANGE.min, SIZE_RANGE.max),
          fps: clamp(custom.fps, FPS_RANGE.min, FPS_RANGE.max),
        },
      }
    }
  } catch {
    // Storage blocked (e.g. private browsing) or bad data: use the defaults.
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Not being able to remember the choice isn't worth bothering anyone.
  }
}
