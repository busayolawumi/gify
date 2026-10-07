import { useEffect, useRef, useState } from 'react'
import { getDuration } from '../lib/convert'
import { CROP_SHAPES, aspectOf, type Crop, type CropShape } from '../lib/crop'
import { formatSize, formatTime } from '../lib/format'
import type { Dimensions } from '../lib/settings'
import { captureFrames } from '../lib/thumbnails'
import { defaultClip, type Clip } from '../lib/video'
import { CropBox } from './CropBox'
import { Timeline } from './Timeline'

// The preview never seeks or loops closer than this to the very end. The last
// frame often starts a little before the reported length, and seeking to the
// exact end can show a blank frame and makes the browser fire `ended`.
const END_MARGIN = 0.05
// Frames in the timeline's thumbnail strip, and their height in pixels. 96px
// stays sharp on high-density screens at the strip's 48px height.
const THUMBNAIL_COUNT = 10
const THUMBNAIL_HEIGHT = 96

type Props = {
  file: File
  /** An object URL for `file`, for the preview. */
  url: string
  clip: Clip | undefined
  onClipChange: (clip: Clip) => void
  /** Called with the video's size once the browser has opened it. */
  onDimensions?: (dimensions: Dimensions) => void
  /** The video's size, once known. Cropping needs it. */
  videoSize?: Dimensions
  cropShape: CropShape
  crop: Crop | undefined
  onCropShapeChange: (shape: CropShape) => void
  onCropChange: (crop: Crop) => void
  onReset: () => void
  /** Stops the video being swapped while a GIF is being made. */
  locked?: boolean
}

export function Editor({
  file,
  url,
  clip,
  onClipChange,
  onDimensions,
  videoSize,
  cropShape,
  crop,
  onCropShapeChange,
  onCropChange,
  onReset,
  locked,
}: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState<number>()
  // 'none' when the browser can't show this video's picture.
  const [preview, setPreview] = useState<'loading' | 'ready' | 'none'>(
    'loading',
  )
  const [unreadable, setUnreadable] = useState(false)
  const [thumbnails, setThumbnails] = useState<(string | undefined)[]>([])
  const scrubbing = useRef(false)
  // Where to seek next once the seek in progress finishes (see handleScrub).
  const nextSeek = useRef<number | undefined>(undefined)
  const durationKnown = useRef(false)
  const askedFFmpeg = useRef(false)
  // The playback loop runs outside React, so it reads the latest clip here.
  const latestClip = useRef(clip)
  useEffect(() => {
    latestClip.current = clip
  }, [clip])

  // Fills the timeline with frames from the video, one by one. If the browser
  // won't cooperate, the timeline just stays plain.
  useEffect(() => {
    if (preview !== 'ready' || duration === undefined) return
    const controller = new AbortController()
    const frames: (string | undefined)[] = []
    captureFrames(
      url,
      duration,
      THUMBNAIL_COUNT,
      THUMBNAIL_HEIGHT,
      (index, src) => {
        frames[index] = src
        setThumbnails([...frames])
      },
      controller.signal,
    ).catch((e) => {
      if (!controller.signal.aborted) console.warn('No thumbnails:', e)
    })
    return () => controller.abort()
  }, [url, duration, preview])

  // Keeps the preview looping inside the selected part.
  useEffect(() => {
    let frame = 0
    function loop() {
      const v = video.current
      const c = latestClip.current
      if (v && c && !v.paused && !scrubbing.current) {
        // Looping just before the video's real end avoids it stopping and
        // firing `ended` first. The margin at the start stops it re-seeking
        // forever if the browser reports a time a hair before the start.
        const loopEnd = Math.min(c.end, v.duration - END_MARGIN)
        if (v.currentTime >= loopEnd || v.currentTime < c.start - 0.1) {
          v.currentTime = c.start
        }
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Pause the preview while a GIF is being made, so FFmpeg gets the CPU.
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (locked) v.pause()
    else if (v.paused) v.play().catch(() => {})
  }, [locked])

  function applyDuration(seconds: number) {
    if (durationKnown.current) return
    durationKnown.current = true
    setDuration(seconds)
    // Coming back with "Edit again" keeps the selection the user made.
    if (!latestClip.current) onClipChange(defaultClip(seconds))
  }

  // For videos the browser can't open, ask FFmpeg how long they are.
  function readDurationWithFFmpeg() {
    if (askedFFmpeg.current) return
    askedFFmpeg.current = true
    getDuration(file).then(applyDuration, (e) => {
      console.error(e)
      setUnreadable(true)
    })
  }

  function handleMetadata(v: HTMLVideoElement) {
    // A width of 0 means the browser can play the sound but not the picture,
    // e.g. HEVC in a browser without HEVC support.
    setPreview(v.videoWidth > 0 ? 'ready' : 'none')
    // Browsers report the size after applying the phone's rotation.
    if (v.videoWidth > 0) {
      onDimensions?.({ width: v.videoWidth, height: v.videoHeight })
    }
    // Some WebM files report an unknown (infinite) length.
    if (Number.isFinite(v.duration) && v.duration > 0) applyDuration(v.duration)
    else readDurationWithFFmpeg()
  }

  function handleError() {
    setPreview('none')
    readDurationWithFFmpeg()
  }

  function handleScrub(time: number | undefined) {
    const v = video.current
    if (!v) return
    scrubbing.current = time !== undefined
    if (time !== undefined) {
      time = Math.min(time, v.duration - END_MARGIN)
      v.pause()
      // Each seek can mean decoding several frames, and a drag asks for one
      // per mouse move. Starting a new seek cancels the one in progress, so
      // the picture never catches up. Instead, only seek once the last one
      // has finished, and go straight to the newest time.
      if (v.seeking) nextSeek.current = time
      else v.currentTime = time
    } else {
      nextSeek.current = undefined
      v.currentTime = latestClip.current?.start ?? 0
      v.play().catch(() => {})
    }
  }

  function handleSeeked(v: HTMLVideoElement) {
    const time = nextSeek.current
    if (time === undefined) return
    nextSeek.current = undefined
    v.currentTime = time
  }

  return (
    <div className="mt-6 w-full max-w-xl text-left sm:mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3 text-sm">
        <p className="min-w-0 truncate">
          <span className="font-medium">{file.name}</span>{' '}
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            · {formatSize(file.size)}
          </span>
        </p>
        <button
          type="button"
          className="-mx-2 -my-3.5 shrink-0 px-2 py-3.5 text-xs text-zinc-500 underline-offset-4 hover:underline disabled:opacity-50 dark:text-zinc-400"
          disabled={locked}
          onClick={onReset}
        >
          Choose another
        </button>
      </div>
      {preview !== 'none' && (
        // The crop box sits on top of the video, in a frame the same size.
        <div className="relative">
          <video
            ref={video}
            src={url}
            className="h-[min(60vh,28rem)] w-full rounded-lg bg-zinc-100 object-contain dark:bg-zinc-900"
            autoPlay
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => handleMetadata(e.currentTarget)}
            onError={handleError}
            onSeeked={(e) => handleSeeked(e.currentTarget)}
            // A backstop for the loop above: if the video reaches its end and
            // stops by itself, start the clip again. Not while dragging,
            // though, or the preview would jump back to the start mid-drag.
            onEnded={(e) => {
              if (scrubbing.current) return
              e.currentTarget.currentTime = latestClip.current?.start ?? 0
              e.currentTarget.play().catch(() => {})
            }}
          />
          {crop && videoSize && (
            <CropBox
              video={videoSize}
              crop={crop}
              aspect={aspectOf(cropShape)}
              onChange={onCropChange}
              disabled={locked}
            />
          )}
        </div>
      )}
      {preview === 'ready' && videoSize && (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-zinc-500 dark:text-zinc-400">
            Crop
          </span>
          {CROP_SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              aria-pressed={shape === cropShape}
              // Choosing a shape, even the current one, gives the biggest
              // box of that shape, centred where the last one was.
              className={`rounded-md px-2.5 py-1.5 text-xs transition disabled:opacity-50 ${
                shape === cropShape
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
              disabled={locked}
              onClick={() => onCropShapeChange(shape)}
            >
              {shape}
            </button>
          ))}
        </div>
      )}
      {preview === 'none' && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {unreadable
            ? "Gify couldn't read this video. Try another one."
            : "Preview isn't available in this browser, but you can still pick the part you want."}
        </div>
      )}

      {duration !== undefined && clip && (
        <div className="mt-4">
          <Timeline
            duration={duration}
            clip={clip}
            thumbnails={thumbnails}
            thumbnailCount={THUMBNAIL_COUNT}
            onChange={onClipChange}
            onScrub={handleScrub}
          />
          <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {formatTime(clip.start)} → {formatTime(clip.end)} ·{' '}
            {(clip.end - clip.start).toFixed(1)}s of {formatTime(duration)}
          </p>
        </div>
      )}
      {duration === undefined && preview === 'none' && !unreadable && (
        <p className="mt-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          Reading the video…
        </p>
      )}
    </div>
  )
}
