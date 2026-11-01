import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react'
import type { AttachedMedia } from '../capture/types'
import type { Size } from './roi'

/**
 * Returns the `<video>` element plus a ref callback that attaches `media`
 * (muted) and detaches it when the media changes or the element unmounts, so
 * the element never keeps a reference to a released stream.
 */
export function useAttachedVideo(
  media: AttachedMedia,
): [HTMLVideoElement | null, RefCallback<HTMLVideoElement>] {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)

  const ref = useCallback(
    (element: HTMLVideoElement | null) => {
      setVideo(element)
      if (!element) return
      // The audio stays in the Meet; this element must never make sound.
      element.muted = true
      if (media.kind === 'stream') {
        element.srcObject = media.stream
      } else {
        element.src = media.url
      }
      element.play().catch((err: unknown) => {
        // AbortError only means the source changed while starting; anything else is real.
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.warn('Falha ao reproduzir a fonte de vídeo', err)
        }
      })
      return () => {
        element.pause()
        element.srcObject = null
        element.removeAttribute('src')
        element.load()
      }
    },
    [media],
  )

  return [video, ref]
}

/** Intrinsic frame size of a `<video>`; updates when the capture resolution changes. */
export function useVideoSize(video: HTMLVideoElement | null): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    if (!video) return
    const read = (): void => {
      const width = video.videoWidth
      const height = video.videoHeight
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    read()
    // `resize` fires when e.g. the captured window is resized.
    video.addEventListener('loadedmetadata', read)
    video.addEventListener('resize', read)
    video.addEventListener('emptied', read)
    return () => {
      video.removeEventListener('loadedmetadata', read)
      video.removeEventListener('resize', read)
      video.removeEventListener('emptied', read)
    }
  }, [video])

  return size
}

/**
 * Calls `onFrame` once per presented video frame using
 * requestVideoFrameCallback, falling back to requestAnimationFrame.
 */
export function useVideoFrames(
  video: HTMLVideoElement | null,
  onFrame: (now: number) => void,
): void {
  const callbackRef = useRef(onFrame)
  useEffect(() => {
    callbackRef.current = onFrame
  }, [onFrame])

  useEffect(() => {
    if (!video) return
    let cancelled = false
    let handle = 0
    const useRvfc = typeof video.requestVideoFrameCallback === 'function'

    const loop = (now: number): void => {
      if (cancelled) return
      callbackRef.current(now)
      schedule()
    }
    const schedule = (): void => {
      handle = useRvfc ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop)
    }

    schedule()
    return () => {
      cancelled = true
      if (useRvfc) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [video])
}
