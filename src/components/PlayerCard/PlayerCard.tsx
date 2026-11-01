import type { RefCallback } from 'react'
import { initials } from '../../features/table/model'

export interface PlayerCardProps {
  name: string
  character: string
  color: string
  /** Receives the portrait canvas; omitted for avatar-only cards. */
  canvasRef?: RefCallback<HTMLCanvasElement>
  /** Source is gone: keep the last frame, dimmed, with a notice. */
  lost?: boolean
  /** Small tag on the portrait, e.g. "Remoto". */
  badge?: string
}

/**
 * A 3:4 portrait with a nameplate. The initials sit *behind* the canvas, so
 * they show until the first frame is drawn and when there is no video at all.
 */
export function PlayerCard({
  name,
  character,
  color,
  canvasRef,
  lost = false,
  badge,
}: PlayerCardProps) {
  const label = character ? `${name}, ${character}` : name
  return (
    <article aria-label={label} className="flex flex-col gap-1.5">
      <div
        className="portrait relative aspect-[3/4] overflow-hidden rounded-2xl border-2 bg-stone-900 shadow-lg shadow-black/40"
        style={{ borderColor: color }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center font-serif text-5xl font-bold text-stone-100/90"
          style={{ background: `radial-gradient(circle at 50% 40%, ${color}55, ${color}11 70%)` }}
        >
          {initials(name)}
        </div>
        {canvasRef && (
          <canvas
            ref={canvasRef}
            data-testid="portrait-canvas"
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition ${lost ? 'opacity-40 grayscale' : ''}`}
          />
        )}
        {badge && (
          <span
            className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-xs font-semibold text-stone-950"
            style={{ backgroundColor: color }}
          >
            {badge}
          </span>
        )}
        {lost && canvasRef && (
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-stone-950/80 px-2 py-1 text-center text-xs text-amber-200">
            Fonte perdida
          </span>
        )}
      </div>
      <div className="min-w-0 px-1 text-center">
        <p className="truncate font-semibold text-stone-100">{name || 'Sem nome'}</p>
        <p className="truncate text-xs text-stone-400">{character || ' '}</p>
      </div>
    </article>
  )
}
