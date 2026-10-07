import type { Dimensions } from './settings'

/** The part of the picture to keep, in video pixels (after rotation). */
export type Crop = { x: number; y: number; width: number; height: number }

export const CROP_SHAPES = [
  'Original',
  'Square',
  '4:5',
  '16:9',
  '9:16',
  'Free',
] as const
export type CropShape = (typeof CROP_SHAPES)[number]

/** Width ÷ height for the fixed shapes. Original and Free have none. */
export function aspectOf(shape: CropShape): number | undefined {
  return { Square: 1, '4:5': 4 / 5, '16:9': 16 / 9, '9:16': 9 / 16 }[
    shape as string
  ]
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

// FFmpeg rounds crops on most phone video down to even numbers anyway, so
// rounding here keeps the size shown in Gify honest.
const even = (n: number) => Math.floor(n / 2) * 2

/** The smallest a crop can get: a tenth of the video's shorter side. */
function minSide(video: Dimensions) {
  return Math.max(16, even(Math.min(video.width, video.height) * 0.1))
}

/** Rounds a crop to even pixels and keeps it inside the video. */
export function snap(crop: Crop, video: Dimensions): Crop {
  const width = clamp(even(crop.width), 2, even(video.width))
  const height = clamp(even(crop.height), 2, even(video.height))
  return {
    x: clamp(even(crop.x), 0, video.width - width),
    y: clamp(even(crop.y), 0, video.height - height),
    width,
    height,
  }
}

/**
 * The crop a shape starts with: the largest one that fits, centred on the
 * previous crop if there was one. Free starts at 80% of the picture so the
 * box is easy to see. Original means no crop.
 */
export function initialCrop(
  shape: CropShape,
  video: Dimensions,
  previous?: Crop,
): Crop | undefined {
  if (shape === 'Original') return undefined
  const aspect = aspectOf(shape)
  let width: number
  let height: number
  if (aspect === undefined) {
    width = video.width * 0.8
    height = video.height * 0.8
  } else if (video.width / video.height > aspect) {
    height = video.height
    width = height * aspect
  } else {
    width = video.width
    height = width / aspect
  }
  const centreX = previous ? previous.x + previous.width / 2 : video.width / 2
  const centreY = previous ? previous.y + previous.height / 2 : video.height / 2
  return snap(
    { x: centreX - width / 2, y: centreY - height / 2, width, height },
    video,
  )
}

/** Moves a crop by (dx, dy) video pixels, stopping at the edges. */
export function moveCrop(
  start: Crop,
  dx: number,
  dy: number,
  video: Dimensions,
): Crop {
  return snap({ ...start, x: start.x + dx, y: start.y + dy }, video)
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

/**
 * Drags one corner of a crop by (dx, dy) video pixels. The opposite corner
 * stays put. With an aspect, the crop keeps its shape. Dragging past the
 * opposite corner flips the crop over.
 */
export function resizeCrop(
  start: Crop,
  corner: Corner,
  dx: number,
  dy: number,
  video: Dimensions,
  aspect?: number,
): Crop {
  const west = corner.includes('w')
  const north = corner.includes('n')
  const right = start.x + start.width
  const bottom = start.y + start.height
  const anchorX = west ? right : start.x
  const anchorY = north ? bottom : start.y
  const pointerX = clamp((west ? start.x : right) + dx, 0, video.width)
  const pointerY = clamp((north ? start.y : bottom) + dy, 0, video.height)

  const towardsRight = pointerX >= anchorX
  const towardsBottom = pointerY >= anchorY
  // Room between the fixed corner and the video's edge, in each direction.
  const roomX = towardsRight ? video.width - anchorX : anchorX
  const roomY = towardsBottom ? video.height - anchorY : anchorY
  const min = minSide(video)

  let width = Math.abs(pointerX - anchorX)
  let height = Math.abs(pointerY - anchorY)
  if (aspect === undefined) {
    width = clamp(width, min, roomX)
    height = clamp(height, min, roomY)
  } else {
    // The biggest box of this shape inside the one the pointer marks out...
    if (width / height > aspect) width = height * aspect
    else height = width / aspect
    // ...no smaller than the minimum...
    if (Math.min(width, height) < min) {
      if (aspect >= 1) [height, width] = [min, min * aspect]
      else [width, height] = [min, min / aspect]
    }
    // ...and no bigger than the room there is.
    if (width > roomX) [width, height] = [roomX, roomX / aspect]
    if (height > roomY) [height, width] = [roomY, roomY * aspect]
  }

  return snap(
    {
      x: towardsRight ? anchorX : anchorX - width,
      y: towardsBottom ? anchorY : anchorY - height,
      width,
      height,
    },
    video,
  )
}
