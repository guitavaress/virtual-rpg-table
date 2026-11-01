import { useCallback, useEffect, useRef, useState } from 'react'
import { FpsMeter } from '../../lib/fpsMeter'
import { normToVideoPixels, type NormRect } from './roi'
import { useVideoFrames } from './useVideo'

const MAX_PREVIEW_WIDTH = 960
const STATS_INTERVAL_MS = 500

export interface RoiPreviewProps {
  video: HTMLVideoElement | null
  roi: NormRect
}

/**
 * Draws the ROI crop of each new video frame into a canvas. This is the seed
 * of the F1 portrait compositor: nothing is stored, sent or read back.
 */
export function RoiPreview({ video, roi }: RoiPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const roiRef = useRef(roi)
  const meter = useRef(new FpsMeter())
  const lastStats = useRef(0)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    roiRef.current = roi
  }, [roi])

  const draw = useCallback(
    (now: number) => {
      const canvas = canvasRef.current
      if (!canvas || !video || video.videoWidth === 0 || video.videoHeight === 0) return

      meter.current.tick(now)
      if (now - lastStats.current >= STATS_INTERVAL_MS) {
        lastStats.current = now
        setFps(meter.current.fps(now))
      }

      const src = normToVideoPixels(roiRef.current, {
        width: video.videoWidth,
        height: video.videoHeight,
      })
      const scale = Math.min(1, MAX_PREVIEW_WIDTH / src.width)
      const width = Math.max(1, Math.round(src.width * scale))
      const height = Math.max(1, Math.round(src.height * scale))
      // Resizing a canvas reallocates it; only do it when the crop size changes.
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, src.x, src.y, src.width, src.height, 0, 0, width, height)
    },
    [video],
  )

  useVideoFrames(video, draw)

  return (
    <figure className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        aria-label="Prévia da região selecionada"
        className="h-auto max-h-[50vh] w-full rounded-lg bg-black object-contain"
      />
      <figcaption className="text-xs text-stone-400">
        Fonte a <span data-testid="source-fps">{fps.toFixed(1)}</span> fps (quadros novos recebidos)
      </figcaption>
    </figure>
  )
}
