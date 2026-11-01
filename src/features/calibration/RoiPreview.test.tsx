import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoiPreview } from './RoiPreview'

/** A <video> whose frame callbacks the test fires by hand. */
function fakeVideo() {
  const video = document.createElement('video')
  Object.defineProperty(video, 'videoWidth', { value: 1280 })
  Object.defineProperty(video, 'videoHeight', { value: 720 })
  let pending: VideoFrameRequestCallback | null = null
  video.requestVideoFrameCallback = (cb) => {
    pending = cb
    return 1
  }
  video.cancelVideoFrameCallback = () => {
    pending = null
  }
  const frame = (now: number) => {
    const cb = pending
    pending = null
    cb?.(now, {} as VideoFrameCallbackMetadata)
  }
  return { video, frame }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('RoiPreview FPS readout', () => {
  it('drops to 0 when the source stops delivering frames', () => {
    vi.useFakeTimers()
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    const { video, frame } = fakeVideo()
    render(<RoiPreview video={video} roi={{ x: 0, y: 0, width: 1, height: 1 }} />)

    act(() => {
      for (let i = 0; i <= 30; i++) {
        clock = (i * 1000) / 30
        frame(clock)
      }
      vi.advanceTimersByTime(500)
    })
    expect(Number(screen.getByTestId('source-fps').textContent)).toBeGreaterThan(25)

    act(() => {
      clock += 3000
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('source-fps').textContent).toBe('0.0')
  })
})
