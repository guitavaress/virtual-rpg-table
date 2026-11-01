import { describe, expect, it } from 'vitest'
import { normToVideoPixels, type NormRect, type Size } from '../calibration/roi'
import {
  clampPortrait,
  distributePortraits,
  FULL_FRAME,
  maxPortraitSize,
  MIN_PORTRAIT_SIZE,
  PORTRAIT_ASPECT,
  portraitFrameRect,
  regionPixels,
  type PortraitCrop,
} from './portrait'

const HD: Size = { width: 1920, height: 1080 }

/** Aspect of a frame-normalized rect in source pixels. */
const pixelAspect = (r: NormRect, video: Size) =>
  (r.width * video.width) / (r.height * video.height)

const expectInside = (inner: NormRect, outer: NormRect) => {
  const eps = 1e-9
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - eps)
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - eps)
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + eps)
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + eps)
}

describe('portraitFrameRect', () => {
  const rois: NormRect[] = [
    { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    { x: 0, y: 0.5, width: 1, height: 0.2 }, // very wide strip
    { x: 0.4, y: 0, width: 0.1, height: 1 }, // very tall strip
    FULL_FRAME,
  ]
  const videos: Size[] = [
    HD,
    { width: 1280, height: 720 },
    { width: 720, height: 1280 },
    { width: 640, height: 480 },
  ]

  it('is always exactly 3:4 in source pixels and inside the region', () => {
    for (const roi of rois) {
      for (const video of videos) {
        for (const crop of [
          { cx: 0.5, cy: 0.5, size: 0.5 },
          { cx: 0, cy: 0, size: 1 },
          { cx: 1, cy: 1, size: 0.01 },
          { cx: 0.9, cy: 0.1, size: 5 },
        ]) {
          const rect = portraitFrameRect(crop, roi, video)
          expect(rect).not.toBeNull()
          if (!rect) continue
          expect(pixelAspect(rect, video)).toBeCloseTo(PORTRAIT_ASPECT, 9)
          expectInside(rect, roi)
        }
      }
    }
  })

  it('moves with the ROI: same crop, shifted ROI → shifted rect, same size', () => {
    const crop = { cx: 0.3, cy: 0.5, size: 0.6 }
    const a = portraitFrameRect(crop, { x: 0.1, y: 0.2, width: 0.5, height: 0.5 }, HD)
    const b = portraitFrameRect(crop, { x: 0.3, y: 0.3, width: 0.5, height: 0.5 }, HD)
    expect(b?.x).toBeCloseTo((a?.x ?? 0) + 0.2, 9)
    expect(b?.y).toBeCloseTo((a?.y ?? 0) + 0.1, 9)
    expect(b?.width).toBeCloseTo(a?.width ?? -1, 9)
  })

  it('stays within ±1px of 3:4 after integer pixel rounding', () => {
    const rect = portraitFrameRect(
      { cx: 0.37, cy: 0.41, size: 0.33 },
      { x: 0.13, y: 0.07, width: 0.71, height: 0.66 },
      HD,
    )
    if (!rect) throw new Error('expected a rect')
    const px = normToVideoPixels(rect, HD)
    expect(Math.abs(px.width - px.height * PORTRAIT_ASPECT)).toBeLessThanOrEqual(1)
  })

  it('returns null until the video has a size', () => {
    expect(
      portraitFrameRect({ cx: 0.5, cy: 0.5, size: 0.5 }, FULL_FRAME, { width: 0, height: 0 }),
    ).toBeNull()
  })
})

describe('clampPortrait', () => {
  const region = { width: 1600, height: 400 } // wide ROI: height is the limit

  it('caps the size so the portrait fits (height-limited and width-limited)', () => {
    expect(maxPortraitSize(region)).toBe(1)
    expect(clampPortrait({ cx: 0.5, cy: 0.5, size: 3 }, region).size).toBe(1)
    const narrow = { width: 300, height: 1000 } // width-limited: max height 400px
    expect(maxPortraitSize(narrow)).toBeCloseTo(0.4, 9)
    expect(clampPortrait({ cx: 0.5, cy: 0.5, size: 1 }, narrow).size).toBeCloseTo(0.4, 9)
  })

  it('enforces the minimum size', () => {
    expect(clampPortrait({ cx: 0.5, cy: 0.5, size: 0 }, region).size).toBe(MIN_PORTRAIT_SIZE)
  })

  it('pushes the center back so no edge leaves the region', () => {
    const c = clampPortrait({ cx: 0, cy: 1, size: 0.5 }, region)
    const halfW = (0.5 * 400 * PORTRAIT_ASPECT) / 1600 / 2
    expect(c.cx).toBeCloseTo(halfW, 9)
    expect(c.cy).toBeCloseTo(0.75, 9)
  })

  it('repairs non-finite input', () => {
    const c = clampPortrait({ cx: Number.NaN, cy: Infinity, size: Number.NaN }, region)
    expect(Number.isFinite(c.cx) && Number.isFinite(c.cy) && Number.isFinite(c.size)).toBe(true)
  })
})

describe('distributePortraits', () => {
  it('places 5 non-overlapping portraits left to right inside the ROI', () => {
    const roi = { x: 0.1, y: 0.2, width: 0.8, height: 0.5 }
    const crops = distributePortraits(5, regionPixels(roi, HD))
    expect(crops).toHaveLength(5)
    const rects = crops.map((c: PortraitCrop) => portraitFrameRect(c, roi, HD))
    const solid = rects.filter((r): r is NormRect => r !== null)
    expect(solid).toHaveLength(5)
    for (const r of solid) expectInside(r, roi)
    // Each right edge is left of the next portrait's left edge.
    const gaps = solid
      .slice(1)
      .map((next, i) => next.x - ((solid[i]?.x ?? 0) + (solid[i]?.width ?? 0)))
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(-1e-9)
  })

  it('falls back to defaults before the video size is known', () => {
    const crops = distributePortraits(5, null)
    expect(crops.map((c) => c.cx)).toEqual([0.1, 0.3, 0.5, 0.7, 0.9])
  })
})
