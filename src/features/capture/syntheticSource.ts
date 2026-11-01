import { StreamOwnership } from './streamOwnership'
import type { AttachedMedia, VideoSource } from './types'

export const SYNTHETIC_WIDTH = 1280
export const SYNTHETIC_HEIGHT = 720
const FPS = 30

const SKIN = ['#f1c27d', '#c68642', '#e0ac69', '#8d5524', '#ffdbac'] as const
const SHIRT = ['#7c3aed', '#059669', '#dc2626', '#2563eb', '#d97706'] as const

/**
 * Draws one frame of a fake "table camera": five cartoon players that bob
 * around, plus a clock so a frozen stream is obvious. No real faces involved.
 */
export function drawSyntheticFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
): void {
  const t = timeMs / 1000
  ctx.fillStyle = '#1e1b2e'
  ctx.fillRect(0, 0, width, height)

  // Back wall stripe and table.
  ctx.fillStyle = '#2a2540'
  ctx.fillRect(0, height * 0.12, width, height * 0.1)
  ctx.fillStyle = '#5b3a1e'
  ctx.beginPath()
  ctx.ellipse(width / 2, height * 0.9, width * 0.48, height * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()

  for (let i = 0; i < 5; i++) {
    const baseX = width * (0.14 + i * 0.18)
    const x = baseX + Math.sin(t * 0.7 + i * 1.3) * width * 0.02
    const y = height * 0.48 + Math.sin(t * 1.1 + i) * height * 0.025
    const r = height * 0.085

    ctx.fillStyle = SHIRT[i] ?? '#888'
    ctx.beginPath()
    ctx.ellipse(x, y + r * 2.4, r * 1.6, r * 1.2, 0, Math.PI, 0)
    ctx.fill()

    ctx.fillStyle = SKIN[i] ?? '#ccc'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    const blink = Math.sin(t * 2 + i * 2) > 0.97
    ctx.fillStyle = '#1a1a1a'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(
        x + side * r * 0.35,
        y - r * 0.15,
        r * 0.1,
        blink ? r * 0.02 : r * 0.12,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = Math.max(2, r * 0.06)
    ctx.beginPath()
    ctx.arc(x, y + r * 0.2, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()

    ctx.fillStyle = '#f5f5f4'
    ctx.font = `bold ${Math.round(height * 0.035)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`J${i + 1}`, x, y + r * 3.1)
  }

  ctx.fillStyle = '#a8a29e'
  ctx.font = `${Math.round(height * 0.03)}px ui-monospace, monospace`
  ctx.textAlign = 'left'
  ctx.fillText(`fonte sintética · ${t.toFixed(1)}s`, width * 0.02, height * 0.06)
}

/** Generated in the page via canvas.captureStream(): no permission, no camera. */
export class SyntheticTestSource implements VideoSource {
  readonly kind = 'synthetic'
  readonly label = 'Fonte sintética (5 jogadores de teste)'
  private readonly ownership = new StreamOwnership()
  private timer: ReturnType<typeof setInterval> | null = null

  async start(): Promise<AttachedMedia> {
    this.stop()
    const canvas = document.createElement('canvas')
    canvas.width = SYNTHETIC_WIDTH
    canvas.height = SYNTHETIC_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx || typeof canvas.captureStream !== 'function') {
      throw new DOMException('canvas.captureStream() não é suportado.', 'NotSupportedError')
    }
    const startedAt = performance.now()
    const draw = (): void =>
      drawSyntheticFrame(ctx, canvas.width, canvas.height, performance.now() - startedAt)
    draw()
    const stream = canvas.captureStream(FPS)
    this.ownership.adopt(stream)
    // setInterval (not rAF) so frames keep coming while the canvas is offscreen.
    this.timer = setInterval(draw, 1000 / FPS)
    return { kind: 'stream', stream }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.ownership.release()
  }

  onEnded(callback: () => void): () => void {
    return this.ownership.onEnded(callback)
  }
}
