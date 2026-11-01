import { describe, expect, it } from 'vitest'
import { FpsMeter } from './fpsMeter'

describe('FpsMeter', () => {
  it('measures a steady 30 fps', () => {
    const meter = new FpsMeter()
    for (let i = 0; i <= 30; i++) meter.tick((i * 1000) / 30)
    expect(meter.fps(1000)).toBeCloseTo(30, 5)
  })

  it('reports 0 with fewer than two frames', () => {
    const meter = new FpsMeter()
    expect(meter.fps(0)).toBe(0)
    meter.tick(10)
    expect(meter.fps(10)).toBe(0)
  })

  it('forgets frames older than the window (frozen source → 0)', () => {
    const meter = new FpsMeter(1000)
    for (let i = 0; i < 10; i++) meter.tick(i * 33)
    expect(meter.fps(5000)).toBe(0)
  })
})
