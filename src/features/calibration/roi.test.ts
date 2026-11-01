import { describe, expect, it } from 'vitest'
import {
  clampRect,
  clientToNorm,
  containedRect,
  HANDLES,
  MIN_ROI_SIZE,
  moveRect,
  normToClient,
  normToVideoPixels,
  resizeRect,
  type NormRect,
} from './roi'

const close = (a: NormRect, b: NormRect) => {
  expect(a.x).toBeCloseTo(b.x, 9)
  expect(a.y).toBeCloseTo(b.y, 9)
  expect(a.width).toBeCloseTo(b.width, 9)
  expect(a.height).toBeCloseTo(b.height, 9)
}

const insideUnit = (r: NormRect) => {
  expect(r.x).toBeGreaterThanOrEqual(0)
  expect(r.y).toBeGreaterThanOrEqual(0)
  expect(r.x + r.width).toBeLessThanOrEqual(1 + 1e-12)
  expect(r.y + r.height).toBeLessThanOrEqual(1 + 1e-12)
}

describe('containedRect (object-fit: contain)', () => {
  it('letterboxes top/bottom for a wide video in a tall box', () => {
    expect(containedRect({ width: 1000, height: 1000 }, { width: 1920, height: 1080 })).toEqual({
      x: 0,
      y: (1000 - 562.5) / 2,
      width: 1000,
      height: 562.5,
    })
  })

  it('pillarboxes left/right for a tall video in a wide box', () => {
    expect(containedRect({ width: 1600, height: 900 }, { width: 720, height: 1280 })).toEqual({
      x: (1600 - 506.25) / 2,
      y: 0,
      width: 506.25,
      height: 900,
    })
  })

  it('fills exactly when aspect ratios match', () => {
    expect(containedRect({ width: 1280, height: 720 }, { width: 1920, height: 1080 })).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    })
  })

  it('returns an empty rect while the video has no size yet', () => {
    expect(containedRect({ width: 800, height: 600 }, { width: 0, height: 0 }).width).toBe(0)
    expect(containedRect({ width: 0, height: 600 }, { width: 1920, height: 1080 }).width).toBe(0)
  })
})

describe('client ↔ normalized', () => {
  const display = { x: 0, y: 218.75, width: 1000, height: 562.5 }

  it('round-trips a rect', () => {
    const roi = { x: 0.2, y: 0.25, width: 0.5, height: 0.4 }
    const px = normToClient(roi, display)
    const tl = clientToNorm({ x: px.x, y: px.y }, display)
    const br = clientToNorm({ x: px.x + px.width, y: px.y + px.height }, display)
    close({ x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y }, roi)
  })

  it('maps points in the letterbox bars outside [0,1]', () => {
    expect(clientToNorm({ x: 500, y: 0 }, display).y).toBeLessThan(0)
  })

  it('guards against a zero-size display', () => {
    expect(clientToNorm({ x: 5, y: 5 }, { x: 0, y: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    })
  })
})

describe('clampRect', () => {
  it('pulls a rect back inside the frame keeping its size', () => {
    expect(clampRect({ x: 0.9, y: -0.2, width: 0.3, height: 0.3 })).toEqual({
      x: 0.7,
      y: 0,
      width: 0.3,
      height: 0.3,
    })
  })

  it('enforces the minimum and maximum size', () => {
    const tiny = clampRect({ x: 0.5, y: 0.5, width: 0.001, height: 0 })
    expect(tiny.width).toBe(MIN_ROI_SIZE)
    expect(tiny.height).toBe(MIN_ROI_SIZE)
    expect(clampRect({ x: 0, y: 0, width: 3, height: 2 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    })
  })

  it('replaces non-finite values', () => {
    insideUnit(clampRect({ x: Number.NaN, y: Infinity, width: Number.NaN, height: 0.5 }))
  })
})

describe('moveRect', () => {
  const roi = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }

  it('translates freely inside the frame', () => {
    close(moveRect(roi, 0.2, 0.1), { x: 0.3, y: 0.2, width: 0.5, height: 0.5 })
  })

  it('stops at every edge without shrinking', () => {
    expect(moveRect(roi, 5, 5)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 })
    expect(moveRect(roi, -5, -5)).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 })
  })
})

describe('resizeRect', () => {
  const roi = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 }

  it.each([
    ['e', 0.1, 0, { x: 0.2, y: 0.2, width: 0.5, height: 0.4 }],
    ['w', -0.1, 0, { x: 0.1, y: 0.2, width: 0.5, height: 0.4 }],
    ['s', 0, 0.1, { x: 0.2, y: 0.2, width: 0.4, height: 0.5 }],
    ['n', 0, -0.1, { x: 0.2, y: 0.1, width: 0.4, height: 0.5 }],
    ['se', 0.1, 0.1, { x: 0.2, y: 0.2, width: 0.5, height: 0.5 }],
    ['nw', -0.1, -0.1, { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }],
    ['ne', 0.1, -0.1, { x: 0.2, y: 0.1, width: 0.5, height: 0.5 }],
    ['sw', -0.1, 0.1, { x: 0.1, y: 0.2, width: 0.5, height: 0.4 + 0.1 }],
  ] as const)('handle %s moves only its edges', (handle, dx, dy, expected) => {
    close(resizeRect(roi, handle, dx, dy), expected)
  })

  it('keeps the opposite edge fixed and respects the minimum size', () => {
    const r = resizeRect(roi, 'w', 10, 0)
    expect(r.x + r.width).toBeCloseTo(0.6, 9)
    expect(r.width).toBeCloseTo(MIN_ROI_SIZE, 9)
  })

  it('never crosses the frame border', () => {
    for (const handle of HANDLES) {
      insideUnit(resizeRect(roi, handle, 10, 10))
      insideUnit(resizeRect(roi, handle, -10, -10))
    }
  })
})

describe('normToVideoPixels', () => {
  it('scales to integer source pixels', () => {
    expect(
      normToVideoPixels(
        { x: 0.25, y: 0.5, width: 0.5, height: 0.25 },
        { width: 1920, height: 1080 },
      ),
    ).toEqual({ x: 480, y: 540, width: 960, height: 270 })
  })

  it('keeps the same ROI meaningful after a resolution change', () => {
    const roi = { x: 0.25, y: 0.5, width: 0.5, height: 0.25 }
    expect(normToVideoPixels(roi, { width: 1280, height: 720 })).toEqual({
      x: 320,
      y: 360,
      width: 640,
      height: 180,
    })
  })

  it('stays inside the frame and is at least 1px', () => {
    const px = normToVideoPixels({ x: 1, y: 1, width: 0, height: 0 }, { width: 640, height: 360 })
    expect(px.x + px.width).toBeLessThanOrEqual(640)
    expect(px.y + px.height).toBeLessThanOrEqual(360)
    expect(px.width).toBeGreaterThanOrEqual(1)
    expect(px.height).toBeGreaterThanOrEqual(1)
  })

  it('returns an empty rect before metadata loads', () => {
    expect(
      normToVideoPixels({ x: 0, y: 0, width: 1, height: 1 }, { width: 0, height: 0 }).width,
    ).toBe(0)
  })
})
