import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { formatTime } from '../lib/format'
import { MAX_CLIP_LENGTH, MIN_CLIP_LENGTH, type Clip } from '../lib/video'

type Handle = 'start' | 'end'

type Props = {
  duration: number
  clip: Clip
  /** Frames from across the video, filled in as they're ready. */
  thumbnails?: (string | undefined)[]
  thumbnailCount?: number
  onChange: (clip: Clip) => void
  /**
   * Called with a handle's time while it's being dragged, then with
   * undefined when it's let go.
   */
  onScrub?: (time: number | undefined) => void
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export function Timeline({
  duration,
  clip,
  thumbnails = [],
  thumbnailCount = 0,
  onChange,
  onScrub,
}: Props) {
  const track = useRef<HTMLDivElement>(null)
  // A video shorter than the minimum can only be used whole.
  const minLength = Math.min(MIN_CLIP_LENGTH, duration)

  // Moves one handle, keeping the clip between the minimum and maximum length.
  function move(handle: Handle, time: number): Clip {
    if (handle === 'start') {
      const earliest = Math.max(0, clip.end - MAX_CLIP_LENGTH)
      return { ...clip, start: clamp(time, earliest, clip.end - minLength) }
    }
    const latest = Math.min(duration, clip.start + MAX_CLIP_LENGTH)
    return { ...clip, end: clamp(time, clip.start + minLength, latest) }
  }

  function timeAt(clientX: number) {
    const rect = track.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration
  }

  function handlePointerDown(handle: Handle, e: PointerEvent<HTMLElement>) {
    // Keeps getting moves even when the pointer leaves the handle.
    e.currentTarget.setPointerCapture(e.pointerId)
    onScrub?.(clip[handle])
  }

  function handlePointerMove(handle: Handle, e: PointerEvent<HTMLElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const next = move(handle, timeAt(e.clientX))
    onChange(next)
    onScrub?.(next[handle])
  }

  function handleKeyDown(handle: Handle, e: KeyboardEvent) {
    const step = e.shiftKey ? 1 : 0.1
    const targets: Record<string, number> = {
      ArrowLeft: clip[handle] - step,
      ArrowDown: clip[handle] - step,
      ArrowRight: clip[handle] + step,
      ArrowUp: clip[handle] + step,
      Home: 0,
      End: duration,
    }
    if (!(e.key in targets)) return
    e.preventDefault()
    onChange(move(handle, targets[e.key]))
  }

  const percent = (time: number) => (time / duration) * 100

  return (
    <div
      ref={track}
      className="relative h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900"
    >
      {/* Slots are laid out up front, so each frame appears in its place. */}
      <div className="absolute inset-0 flex overflow-hidden rounded-lg">
        {Array.from({ length: thumbnailCount }, (_, i) =>
          thumbnails[i] ? (
            <img
              key={i}
              src={thumbnails[i]}
              alt=""
              draggable={false}
              className="h-full min-w-0 flex-1 object-cover"
            />
          ) : (
            <div key={i} className="flex-1" />
          ),
        )}
      </div>
      {/* Fade what's outside the selection. */}
      <div
        className="absolute inset-y-0 left-0 rounded-l-lg bg-white/70 dark:bg-zinc-950/70"
        style={{ width: `${percent(clip.start)}%` }}
      />
      <div
        className="absolute inset-y-0 right-0 rounded-r-lg bg-white/70 dark:bg-zinc-950/70"
        style={{ width: `${100 - percent(clip.end)}%` }}
      />
      <div
        className="absolute inset-y-0 border-y-2 border-accent"
        style={{
          left: `${percent(clip.start)}%`,
          right: `${100 - percent(clip.end)}%`,
        }}
      />
      {(['start', 'end'] as const).map((handle) => (
        <button
          key={handle}
          type="button"
          role="slider"
          aria-label={
            handle === 'start' ? 'Start of the GIF' : 'End of the GIF'
          }
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={clip[handle]}
          aria-valuetext={formatTime(clip[handle])}
          // A wide, invisible hit area around a thin bar, so it's easy to grab
          // with a finger.
          className="group absolute inset-y-0 w-8 -translate-x-1/2 cursor-ew-resize touch-none focus-visible:outline-none"
          style={{ left: `${percent(clip[handle])}%` }}
          onPointerDown={(e) => handlePointerDown(handle, e)}
          onPointerMove={(e) => handlePointerMove(handle, e)}
          onLostPointerCapture={() => onScrub?.(undefined)}
          onKeyDown={(e) => handleKeyDown(handle, e)}
        >
          <span className="mx-auto block h-full w-1.5 rounded-full bg-accent group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 dark:ring-offset-zinc-950" />
        </button>
      ))}
    </div>
  )
}
