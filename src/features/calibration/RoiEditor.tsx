import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { HANDLES, moveRect, resizeRect, type Handle, type NormRect, type Rect } from './roi'

const KEY_STEP = 0.01
const KEY_STEP_FINE = 0.002

const pct = (value: number): string => `${Math.round(value * 100)}%`

const HANDLE_POSITION: Record<Handle, string> = {
  nw: 'left-0 top-0 cursor-nwse-resize',
  n: 'left-1/2 top-0 cursor-ns-resize',
  ne: 'left-full top-0 cursor-nesw-resize',
  e: 'left-full top-1/2 cursor-ew-resize',
  se: 'left-full top-full cursor-nwse-resize',
  s: 'left-1/2 top-full cursor-ns-resize',
  sw: 'left-0 top-full cursor-nesw-resize',
  w: 'left-0 top-1/2 cursor-ew-resize',
}

interface DragState {
  pointerId: number
  mode: 'move' | Handle
  startX: number
  startY: number
  startRoi: NormRect
}

export interface RoiEditorProps {
  /** Where the video frame is actually drawn inside the container (letterbox-aware). */
  display: Rect
  roi: NormRect
  onChange(roi: NormRect): void
}

/**
 * Draggable/resizable region over the video. Works in normalized units, so the
 * same ROI stays valid when the window or the capture resolution changes.
 */
export function RoiEditor({ display, roi, onChange }: RoiEditorProps) {
  const drag = useRef<DragState | null>(null)

  if (display.width <= 0 || display.height <= 0) return null

  const beginDrag = (event: PointerEvent<HTMLElement>, mode: DragState['mode']): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startRoi: roi,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    // Always derive from the drag start to avoid accumulating rounding drift.
    const dx = (event.clientX - state.startX) / display.width
    const dy = (event.clientY - state.startY) / display.height
    onChange(
      state.mode === 'move'
        ? moveRect(state.startRoi, dx, dy)
        : resizeRect(state.startRoi, state.mode, dx, dy),
    )
  }

  const endDrag = (event: PointerEvent<HTMLElement>): void => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const step = event.altKey ? KEY_STEP_FINE : KEY_STEP
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const d = delta[event.key]
    if (!d) return
    event.preventDefault()
    onChange(event.shiftKey ? resizeRect(roi, 'se', d[0], d[1]) : moveRect(roi, d[0], d[1]))
  }

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{ left: display.x, top: display.y, width: display.width, height: display.height }}
    >
      <div
        role="group"
        tabIndex={0}
        aria-label={`Região da câmera coletiva: começa em ${pct(roi.x)} da esquerda e ${pct(roi.y)} do topo, com ${pct(roi.width)} de largura e ${pct(roi.height)} de altura. Setas movem; Shift + setas redimensionam; Alt deixa o passo fino.`}
        data-testid="roi-box"
        className="pointer-events-auto absolute cursor-move touch-none border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60"
        style={{
          left: `${roi.x * 100}%`,
          top: `${roi.y * 100}%`,
          width: `${roi.width * 100}%`,
          height: `${roi.height * 100}%`,
        }}
        onPointerDown={(e) => beginDrag(e, 'move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <span className="absolute left-1 top-1 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-semibold text-stone-950 select-none">
          Câmera coletiva
        </span>
        {HANDLES.map((handle) => (
          <span
            key={handle}
            data-handle={handle}
            aria-hidden="true"
            className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-stone-950 bg-amber-400 ${HANDLE_POSITION[handle]}`}
            onPointerDown={(e) => beginDrag(e, handle)}
          />
        ))}
      </div>
    </div>
  )
}
