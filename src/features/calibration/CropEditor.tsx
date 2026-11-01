import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  clampPortrait,
  FULL_FRAME,
  PORTRAIT_ASPECT,
  portraitFrameRect,
  regionPixels,
  type PortraitCrop,
} from '../compositor/portrait'
import type { NormRect, Rect, Size } from './roi'

const KEY_STEP = 0.01
const KEY_STEP_FINE = 0.002
const ZOOM_STEP = 0.02

export interface CropBox {
  id: string
  label: string
  color: string
  crop: PortraitCrop
  /** 'roi' for table players, 'frame' for the remote self-preview. */
  region: 'roi' | 'frame'
}

export interface CropEditorProps {
  /** Where the video frame is drawn inside the stage (letterbox-aware). */
  display: Rect
  video: Size
  roi: NormRect
  boxes: readonly CropBox[]
  onChange(id: string, crop: PortraitCrop): void
}

interface DragState {
  pointerId: number
  id: string
  mode: 'move' | 'scale'
  startX: number
  startY: number
  startCrop: PortraitCrop
}

const pct = (v: number): string => `${v * 100}%`

/**
 * Overlay with one draggable 3:4 frame per portrait. Body drag moves; the
 * corner handle zooms around the center; arrows move and +/- zoom.
 */
export function CropEditor({ display, video, roi, boxes, onChange }: CropEditorProps) {
  const drag = useRef<DragState | null>(null)
  if (display.width <= 0 || display.height <= 0) return null

  const regionOf = (box: CropBox): NormRect => (box.region === 'roi' ? roi : FULL_FRAME)

  const update = (box: CropBox, next: PortraitCrop): void => {
    const regionPx = regionPixels(regionOf(box), video)
    onChange(box.id, regionPx ? clampPortrait(next, regionPx) : next)
  }

  const beginDrag = (event: PointerEvent<HTMLElement>, box: CropBox, mode: DragState['mode']) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      id: box.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startCrop: box.crop,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>, box: CropBox): void => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId || state.id !== box.id) return
    const region = regionOf(box)
    const regionW = display.width * region.width
    const regionH = display.height * region.height
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    const start = state.startCrop
    if (state.mode === 'move') {
      update(box, { ...start, cx: start.cx + dx / regionW, cy: start.cy + dy / regionH })
    } else {
      // Zoom around the center: the dragged corner follows the pointer.
      update(box, { ...start, size: start.size + (dy + dx / PORTRAIT_ASPECT) / regionH })
    }
  }

  const endDrag = (event: PointerEvent<HTMLElement>): void => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, box: CropBox): void => {
    const step = event.altKey ? KEY_STEP_FINE : KEY_STEP
    const c = box.crop
    const moves: Record<string, PortraitCrop> = {
      ArrowLeft: { ...c, cx: c.cx - step },
      ArrowRight: { ...c, cx: c.cx + step },
      ArrowUp: { ...c, cy: c.cy - step },
      ArrowDown: { ...c, cy: c.cy + step },
      '+': { ...c, size: c.size + ZOOM_STEP },
      '=': { ...c, size: c.size + ZOOM_STEP },
      '-': { ...c, size: c.size - ZOOM_STEP },
    }
    const next = moves[event.key]
    if (!next) return
    event.preventDefault()
    update(box, next)
  }

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{ left: display.x, top: display.y, width: display.width, height: display.height }}
    >
      {/* ROI reference: dims everything outside the table camera. */}
      <div
        aria-hidden="true"
        className="absolute border border-dashed border-amber-200/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        style={{
          left: pct(roi.x),
          top: pct(roi.y),
          width: pct(roi.width),
          height: pct(roi.height),
        }}
      />
      {boxes.map((box) => {
        const rect = portraitFrameRect(box.crop, regionOf(box), video)
        if (!rect) return null
        return (
          <div
            key={box.id}
            role="group"
            tabIndex={0}
            data-testid={`crop-${box.id}`}
            aria-label={`Recorte de ${box.label}. Setas movem; + e - ajustam o zoom; Alt deixa o passo fino.`}
            className="pointer-events-auto absolute cursor-move touch-none border-2 outline-none focus-visible:ring-4 focus-visible:ring-white/60"
            style={{
              left: pct(rect.x),
              top: pct(rect.y),
              width: pct(rect.width),
              height: pct(rect.height),
              borderColor: box.color,
              borderStyle: box.region === 'frame' ? 'dashed' : 'solid',
            }}
            onPointerDown={(e) => beginDrag(e, box, 'move')}
            onPointerMove={(e) => onPointerMove(e, box)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(e) => onKeyDown(e, box)}
          >
            <span
              className="absolute left-0 top-0 max-w-full truncate px-1 text-xs font-semibold text-stone-950 select-none"
              style={{ backgroundColor: box.color }}
            >
              {box.label}
            </span>
            <span
              aria-hidden="true"
              data-handle="zoom"
              className="absolute left-full top-full h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-sm border-2 border-stone-950"
              style={{ backgroundColor: box.color }}
              onPointerDown={(e) => beginDrag(e, box, 'scale')}
            />
          </div>
        )
      })}
    </div>
  )
}
