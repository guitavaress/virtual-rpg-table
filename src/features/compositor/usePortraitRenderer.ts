import { useCallback, useEffect, useRef } from 'react'
import { normToVideoPixels, type NormRect } from '../calibration/roi'
import { useVideoFrames } from '../calibration/useVideo'

/** Portraits taller than this are downscaled on the canvas (CSS scales anyway). */
const MAX_CANVAS_HEIGHT = 720

/** Frame-normalized crop rect per slot id; null = nothing to draw. */
export type PortraitRects = Readonly<Record<string, NormRect | null>>

/** Draws one crop of the current video frame into `canvas`. */
export function drawCrop(video: HTMLVideoElement, canvas: HTMLCanvasElement, rect: NormRect): void {
  const src = normToVideoPixels(rect, { width: video.videoWidth, height: video.videoHeight })
  if (src.width === 0 || src.height === 0) return
  const scale = Math.min(1, MAX_CANVAS_HEIGHT / src.height)
  const width = Math.max(1, Math.round(src.width * scale))
  const height = Math.max(1, Math.round(src.height * scale))
  // Resizing a canvas reallocates (and clears) it: only when the crop size changes.
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  canvas
    .getContext('2d')
    ?.drawImage(video, src.x, src.y, src.width, src.height, 0, 0, width, height)
}

/**
 * One frame loop that paints every registered portrait canvas. Components
 * register canvases by slot id via `canvasRef(id)`; the loop reads the latest
 * rects from a ref, so editing crops never restarts it.
 */
export function usePortraitRenderer(video: HTMLVideoElement | null, rects: PortraitRects) {
  const canvases = useRef(new Map<string, HTMLCanvasElement>())
  const refCallbacks = useRef(new Map<string, (el: HTMLCanvasElement | null) => void>())
  const rectsRef = useRef(rects)

  useEffect(() => {
    rectsRef.current = rects
  }, [rects])

  const canvasRef = useCallback((id: string) => {
    let callback = refCallbacks.current.get(id)
    if (!callback) {
      callback = (el) => {
        if (el) canvases.current.set(id, el)
        else canvases.current.delete(id)
      }
      refCallbacks.current.set(id, callback)
    }
    return callback
  }, [])

  const draw = useCallback(() => {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return
    for (const [id, canvas] of canvases.current) {
      const rect = rectsRef.current[id]
      if (rect) drawCrop(video, canvas, rect)
    }
  }, [video])

  useVideoFrames(video, draw)

  return canvasRef
}
