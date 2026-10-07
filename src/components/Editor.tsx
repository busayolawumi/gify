import { useEffect, useRef, useState } from 'react'
import { getDuration } from '../lib/convert'
import { formatSize, formatTime } from '../lib/format'
import { defaultClip, type Clip } from '../lib/video'
import { Timeline } from './Timeline'

// The preview never seeks or loops closer than this to the very end. The last
// frame often starts a little before the reported length, and seeking to the
// exact end can show a blank frame and makes the browser fire `ended`.
const END_MARGIN = 0.05

type Props = {
  file: File
  /** An object URL for `file`, for the preview. */
  url: string
  clip: Clip | undefined
  onClipChange: (clip: Clip) => void
  onReset: () => void
  /** Stops the video being swapped while a GIF is being made. */
  locked?: boolean
}

export function Editor({
  file,
  url,
  clip,
  onClipChange,
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

  function applyDuration(seconds: number) {
    if (durationKnown.current) return
    durationKnown.current = true
    setDuration(seconds)
    onClipChange(defaultClip(seconds))
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
    <div className="mt-10 w-full max-w-xl text-left">
      {preview !== 'none' && (
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
      )}
      {preview === 'none' && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
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
            onChange={onClipChange}
            onScrub={handleScrub}
          />
          <p className="mt-2 font-mono text-xs text-zinc-500">
            {formatTime(clip.start)} → {formatTime(clip.end)} ·{' '}
            {(clip.end - clip.start).toFixed(1)}s of {formatTime(duration)}
          </p>
        </div>
      )}
      {duration === undefined && preview === 'none' && !unreadable && (
        <p className="mt-4 font-mono text-xs text-zinc-500">
          Reading the video…
        </p>
      )}

      <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
        <p className="min-w-0 truncate">
          <span className="font-medium">{file.name}</span>{' '}
          <span className="font-mono text-xs text-zinc-500">
            · {formatSize(file.size)}
          </span>
        </p>
        <button
          type="button"
          className="shrink-0 text-xs text-zinc-500 underline-offset-4 hover:underline disabled:opacity-50"
          disabled={locked}
          onClick={onReset}
        >
          Choose another
        </button>
      </div>
    </div>
  )
}
