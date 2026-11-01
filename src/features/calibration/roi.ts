/**
 * Pure ROI geometry. A `NormRect` is expressed as fractions [0,1] of the
 * source video frame, so it survives resolution changes of the capture.
 */

export interface Size {
  readonly width: number
  readonly height: number
}

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Rect in normalized video coordinates, every field in [0,1]. */
export type NormRect = Rect

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const MIN_ROI_SIZE = 0.05

export const DEFAULT_ROI: NormRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Where content of `content` size is drawn inside `container` with
 * `object-fit: contain` (centered, letterboxed). Pixels, relative to container.
 */
export function containedRect(container: Size, content: Size): Rect {
  if (container.width <= 0 || container.height <= 0 || content.width <= 0 || content.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  // Pin the constrained axis exactly to the container to avoid float drift.
  const fitsWidth = container.width / container.height <= content.width / content.height
  const width = fitsWidth ? container.width : (content.width * container.height) / content.height
  const height = fitsWidth ? (content.height * container.width) / content.width : container.height
  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  }
}

/** Display pixel → normalized coordinate (not clamped). */
export function clientToNorm(point: Point, display: Rect): Point {
  if (display.width <= 0 || display.height <= 0) return { x: 0, y: 0 }
  return {
    x: (point.x - display.x) / display.width,
    y: (point.y - display.y) / display.height,
  }
}

/** Normalized rect → display pixels. */
export function normToClient(rect: NormRect, display: Rect): Rect {
  return {
    x: display.x + rect.x * display.width,
    y: display.y + rect.y * display.height,
    width: rect.width * display.width,
    height: rect.height * display.height,
  }
}

/** Forces a rect fully inside [0,1] with each side ≥ `minSize`. */
export function clampRect(rect: NormRect, minSize = MIN_ROI_SIZE): NormRect {
  const finite = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback)
  const width = clamp(finite(rect.width, 1), minSize, 1)
  const height = clamp(finite(rect.height, 1), minSize, 1)
  return {
    x: clamp(finite(rect.x, 0), 0, 1 - width),
    y: clamp(finite(rect.y, 0), 0, 1 - height),
    width,
    height,
  }
}

/** Translates without resizing; stops at the frame edges. */
export function moveRect(rect: NormRect, dx: number, dy: number, minSize = MIN_ROI_SIZE): NormRect {
  const base = clampRect(rect, minSize)
  return clampRect({ ...base, x: base.x + dx, y: base.y + dy }, minSize)
}

/**
 * Drags one edge/corner by (dx, dy). The opposite edge stays fixed; edges
 * stop at the frame border and at `minSize` from the opposite edge.
 */
export function resizeRect(
  rect: NormRect,
  handle: Handle,
  dx: number,
  dy: number,
  minSize = MIN_ROI_SIZE,
): NormRect {
  const base = clampRect(rect, minSize)
  let left = base.x
  let top = base.y
  let right = base.x + base.width
  let bottom = base.y + base.height

  if (handle.includes('w')) left = clamp(left + dx, 0, right - minSize)
  if (handle.includes('e')) right = clamp(right + dx, left + minSize, 1)
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - minSize)
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + minSize, 1)

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Normalized rect → integer source-pixel rect, always inside the frame and ≥ 1px. */
export function normToVideoPixels(rect: NormRect, video: Size): Rect {
  if (video.width <= 0 || video.height <= 0) return { x: 0, y: 0, width: 0, height: 0 }
  const r = clampRect(rect, 0)
  const x = clamp(Math.round(r.x * video.width), 0, video.width - 1)
  const y = clamp(Math.round(r.y * video.height), 0, video.height - 1)
  const right = clamp(Math.round((r.x + r.width) * video.width), x + 1, video.width)
  const bottom = clamp(Math.round((r.y + r.height) * video.height), y + 1, video.height)
  return { x, y, width: right - x, height: bottom - y }
}
