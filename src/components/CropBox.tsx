import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { moveCrop, resizeCrop, type Corner, type Crop } from '../lib/crop'
import type { Dimensions } from '../lib/settings'

type Props = {
  /** The video's size in pixels. */
  video: Dimensions
  crop: Crop
  /** Width ÷ height to keep while resizing. Omit for free cropping. */
  aspect?: number
  onChange: (crop: Crop) => void
  disabled?: boolean
}

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

/**
 * A crop box drawn over the preview. It fills its parent, which should be
 * exactly the size of the <video> element.
 */
export function CropBox({ video, crop, aspect, onChange, disabled }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const [frameSize, setFrameSize] = useState<Dimensions>()
  // What's being dragged, and where the pointer and crop were when it began.
  const drag = useRef<
    { kind: 'move' | Corner; x: number; y: number; start: Crop } | undefined
  >(undefined)

  useEffect(() => {
    const element = frame.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setFrameSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The preview is scaled to fit (object-contain), so the picture may have
  // bars beside or above it. Work out where the picture itself is.
  const scale = frameSize
    ? Math.min(frameSize.width / video.width, frameSize.height / video.height)
    : 0
  const picture = frameSize && {
    width: video.width * scale,
    height: video.height * scale,
    left: (frameSize.width - video.width * scale) / 2,
    top: (frameSize.height - video.height * scale) / 2,
  }

  function handlePointerDown(kind: 'move' | Corner, e: PointerEvent) {
    // A corner sits inside the box, so don't let the box start a move too.
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { kind, x: e.clientX, y: e.clientY, start: crop }
  }

  function handlePointerMove(e: PointerEvent) {
    const d = drag.current
    if (!d || !scale || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    // Screen pixels to video pixels.
    const dx = (e.clientX - d.x) / scale
    const dy = (e.clientY - d.y) / scale
    onChange(
      d.kind === 'move'
        ? moveCrop(d.start, dx, dy, video)
        : resizeCrop(d.start, d.kind, dx, dy, video, aspect),
    )
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Arrows nudge the box by 1% of the video, or 10% with Shift.
    const step = (e.shiftKey ? 0.1 : 0.01) * Math.max(video.width, video.height)
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    onChange(moveCrop(crop, move[0], move[1], video))
  }

  const box = {
    left: `${(crop.x / video.width) * 100}%`,
    top: `${(crop.y / video.height) * 100}%`,
    width: `${(crop.width / video.width) * 100}%`,
    height: `${(crop.height / video.height) * 100}%`,
  }

  return (
    <div ref={frame} className="absolute inset-0">
      {picture && (
        <>
          {/* Fades everything outside the box. Clipped to the picture, so the
              huge shadow doesn't spill over the bars. */}
          <div
            className="pointer-events-none absolute overflow-hidden rounded-lg"
            style={picture}
          >
            <div
              className="absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
              style={box}
            />
          </div>
          {/* The box itself. Not clipped, so corner handles at the picture's
              edge stay easy to grab. */}
          <div
            className={`absolute ${disabled ? 'pointer-events-none' : ''}`}
            style={picture}
          >
            <div
              role="group"
              aria-label="Crop area. Drag or use the arrow keys to move it, and drag the corners to resize it."
              tabIndex={disabled ? -1 : 0}
              className="absolute cursor-move touch-none border-2 border-white outline-none focus-visible:border-accent"
              style={box}
              onPointerDown={(e) => handlePointerDown('move', e)}
              onPointerMove={handlePointerMove}
              onLostPointerCapture={() => (drag.current = undefined)}
              onKeyDown={handleKeyDown}
            >
              {CORNERS.map((corner) => (
                <button
                  key={corner}
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  // A 32px hit area around a small visible square.
                  className={`absolute size-8 -translate-x-1/2 -translate-y-1/2 touch-none ${
                    corner === 'nw' || corner === 'se'
                      ? 'cursor-nwse-resize'
                      : 'cursor-nesw-resize'
                  }`}
                  style={{
                    left: corner.includes('w') ? '0%' : '100%',
                    top: corner.includes('n') ? '0%' : '100%',
                  }}
                  onPointerDown={(e) => handlePointerDown(corner, e)}
                  onPointerMove={handlePointerMove}
                  onLostPointerCapture={() => (drag.current = undefined)}
                >
                  <span className="mx-auto block size-3.5 rounded-sm bg-white shadow ring-1 ring-black/20" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
