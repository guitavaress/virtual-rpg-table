import type { NormRect, Size } from '../calibration/roi'

/** Portrait width / height in source pixels (3:4, vertical). */
export const PORTRAIT_ASPECT = 3 / 4

/** Smallest portrait height, as a fraction of its region's height. */
export const MIN_PORTRAIT_SIZE = 0.08

/**
 * A portrait crop inside a region (the ROI for table players, the whole frame
 * for the remote player). `cx`/`cy` is the center as a fraction of the region;
 * `size` is the portrait height as a fraction of the region height. Width is
 * derived from PORTRAIT_ASPECT in *pixels*, so portraits never distort.
 */
export interface PortraitCrop {
  readonly cx: number
  readonly cy: number
  readonly size: number
}

export const FULL_FRAME: NormRect = { x: 0, y: 0, width: 1, height: 1 }

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Region size in source pixels, or null while the video has no size. */
export function regionPixels(region: NormRect, video: Size): Size | null {
  const width = region.width * video.width
  const height = region.height * video.height
  return width > 0 && height > 0 ? { width, height } : null
}

/** Largest `size` whose portrait still fits inside the region. */
export function maxPortraitSize(regionPx: Size, aspect = PORTRAIT_ASPECT): number {
  const maxHeightPx = Math.min(regionPx.height, regionPx.width / aspect)
  return maxHeightPx / regionPx.height
}

/** Portrait width as a fraction of the region width. */
function widthFraction(size: number, regionPx: Size, aspect: number): number {
  return (size * regionPx.height * aspect) / regionPx.width
}

/** Keeps the portrait inside its region with a valid size. */
export function clampPortrait(
  crop: PortraitCrop,
  regionPx: Size,
  aspect = PORTRAIT_ASPECT,
): PortraitCrop {
  const finite = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback)
  const max = maxPortraitSize(regionPx, aspect)
  const size = clamp(finite(crop.size, max / 2), Math.min(MIN_PORTRAIT_SIZE, max), max)
  const halfW = widthFraction(size, regionPx, aspect) / 2
  const halfH = size / 2
  return {
    cx: clamp(finite(crop.cx, 0.5), halfW, 1 - halfW),
    cy: clamp(finite(crop.cy, 0.5), halfH, 1 - halfH),
    size,
  }
}

/**
 * The portrait as a rect normalized to the full video frame (ready for
 * `normToVideoPixels`), or null while the video has no size.
 */
export function portraitFrameRect(
  crop: PortraitCrop,
  region: NormRect,
  video: Size,
  aspect = PORTRAIT_ASPECT,
): NormRect | null {
  const regionPx = regionPixels(region, video)
  if (!regionPx) return null
  const c = clampPortrait(crop, regionPx, aspect)
  const w = widthFraction(c.size, regionPx, aspect)
  return {
    x: region.x + (c.cx - w / 2) * region.width,
    y: region.y + (c.cy - c.size / 2) * region.height,
    width: w * region.width,
    height: c.size * region.height,
  }
}

/**
 * `count` portraits side by side in equal columns, as large as the columns
 * allow (with a small gap). Without a known region size, uses safe defaults.
 */
export function distributePortraits(
  count: number,
  regionPx: Size | null,
  aspect = PORTRAIT_ASPECT,
): PortraitCrop[] {
  return Array.from({ length: count }, (_, i) => {
    const cx = (i + 0.5) / count
    if (!regionPx) return { cx, cy: 0.5, size: 0.5 }
    const columnHeightPx = (regionPx.width / count / aspect) * 0.92
    const size = Math.min(columnHeightPx / regionPx.height, maxPortraitSize(regionPx, aspect) * 0.9)
    return clampPortrait({ cx, cy: 0.5, size }, regionPx, aspect)
  })
}
