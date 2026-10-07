import { formatSize } from './format'

// Only formats browsers can play, because the editor previews the video.
const EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm']
const TYPES = ['video/mp4', 'video/x-m4v', 'video/quicktime', 'video/webm']

/** For the file picker's `accept` attribute. */
export const ACCEPT = [...TYPES, ...EXTENSIONS.map((ext) => `.${ext}`)].join(
  ',',
)

// ffmpeg.wasm holds the whole file in memory, and bigger files crash phone
// browsers.
export const MAX_FILE_SIZE = 200_000_000

/** Says why Gify can't take this file, or returns undefined if it can. */
export function checkVideo(file: File): string | undefined {
  const dot = file.name.lastIndexOf('.')
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : ''
  // Some browsers give .mov files no type, so the extension counts too.
  const supported = TYPES.includes(file.type) || EXTENSIONS.includes(extension)

  if (!supported) {
    return file.type.startsWith('video/') && extension
      ? `Gify can't open .${extension} videos yet. Try an MP4, MOV or WebM.`
      : "That doesn't look like a video. Try an MP4, MOV or WebM."
  }
  if (file.size > MAX_FILE_SIZE) {
    return `That video is ${formatSize(file.size)}. Gify can take videos up to ${formatSize(MAX_FILE_SIZE)}.`
  }
}

export type Clip = { start: number; end: number }

// GIFs get huge and slow to make past this.
export const MAX_CLIP_LENGTH = 15
export const MIN_CLIP_LENGTH = 0.5

/** The first 5 seconds, or the whole video if it's shorter. */
export function defaultClip(duration: number): Clip {
  return { start: 0, end: Math.min(duration, 5) }
}
