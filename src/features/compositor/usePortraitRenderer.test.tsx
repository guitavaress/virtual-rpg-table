import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { usePortraitRenderer, type PortraitRects } from './usePortraitRenderer'

function fakeVideo() {
  const video = document.createElement('video')
  Object.defineProperty(video, 'videoWidth', { value: 1280 })
  Object.defineProperty(video, 'videoHeight', { value: 720 })
  const pending = new Set<VideoFrameRequestCallback>()
  let next = 1
  const ids = new Map<number, VideoFrameRequestCallback>()
  video.requestVideoFrameCallback = (cb) => {
    pending.add(cb)
    ids.set(next, cb)
    return next++
  }
  video.cancelVideoFrameCallback = (id) => {
    const cb = ids.get(id)
    if (cb) pending.delete(cb)
  }
  const frame = () => {
    const cbs = [...pending]
    pending.clear()
    for (const cb of cbs) cb(performance.now(), {} as VideoFrameCallbackMetadata)
  }
  return { video, frame, loops: () => pending.size }
}

const rects: PortraitRects = {
  a: { x: 0, y: 0, width: 0.3, height: 0.5 },
  b: { x: 0.5, y: 0, width: 0.3, height: 0.5 },
}

function Probe({ video, show }: { video: HTMLVideoElement; show: string[] }) {
  const canvasRef = usePortraitRenderer(video, rects)
  return (
    <>
      {show.map((id) => (
        <canvas key={id} data-id={id} ref={canvasRef(id)} />
      ))}
    </>
  )
}

describe('usePortraitRenderer', () => {
  it('draws every registered canvas once per frame, with a single loop', () => {
    const draws = new Map<string, number>()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      const id = this.dataset.id ?? '?'
      return { drawImage: () => draws.set(id, (draws.get(id) ?? 0) + 1) } as never
    })
    const { video, frame, loops } = fakeVideo()
    const { rerender } = render(
      <StrictMode>
        <Probe video={video} show={['a', 'b']} />
      </StrictMode>,
    )
    expect(loops()).toBe(1)
    act(() => frame())
    expect(Object.fromEntries(draws)).toEqual({ a: 1, b: 1 })

    // An unmounted canvas must stop being painted (no orphan in the registry).
    rerender(
      <StrictMode>
        <Probe video={video} show={['a']} />
      </StrictMode>,
    )
    act(() => frame())
    expect(Object.fromEntries(draws)).toEqual({ a: 2, b: 1 })
    expect(loops()).toBe(1)
  })
})
