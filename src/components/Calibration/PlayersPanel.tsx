import type { RefCallback } from 'react'
import type { Size } from '../../features/calibration/roi'
import {
  FULL_FRAME,
  maxPortraitSize,
  MIN_PORTRAIT_SIZE,
  regionPixels,
} from '../../features/compositor/portrait'
import {
  CHARACTER_MAX,
  NAME_MAX,
  PLAYER_COLORS,
  type PlayerId,
  type PlayerSlot,
  type RemoteSlot,
  type TableConfig,
} from '../../features/table/model'
import { buttonSecondary, inputText } from '../ui'

type SlotPatch = Partial<Pick<PlayerSlot, 'name' | 'character' | 'crop'>>
type RemotePatch = Partial<Pick<RemoteSlot, 'name' | 'character' | 'crop' | 'mode'>>

export interface PlayersPanelProps {
  config: TableConfig
  video: Size
  canvasRef(id: string): RefCallback<HTMLCanvasElement>
  onPlayerChange(id: PlayerId, patch: SlotPatch): void
  onRemoteChange(patch: RemotePatch): void
  onDistribute(): void
}

/** Side panel of step 2: live thumbnail, name, character and zoom per seat. */
export function PlayersPanel({
  config,
  video,
  canvasRef,
  onPlayerChange,
  onRemoteChange,
  onDistribute,
}: PlayersPanelProps) {
  const roiPx = regionPixels(config.roi, video)
  const framePx = regionPixels(FULL_FRAME, video)
  const maxRoiSize = roiPx ? maxPortraitSize(roiPx) : 1
  const maxFrameSize = framePx ? maxPortraitSize(framePx) : 1
  const remote = config.remote

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-400">
          Arraste cada moldura até o rosto; a alça do canto ajusta o zoom.
        </p>
        <button type="button" onClick={onDistribute} className={buttonSecondary}>
          Distribuir automaticamente
        </button>
      </div>

      <ol className="flex flex-col gap-2">
        {config.players.map((p, i) => (
          <SlotRow
            key={p.id}
            id={p.id}
            index={`${i + 1}`}
            color={PLAYER_COLORS[p.id]}
            name={p.name}
            character={p.character}
            size={p.crop.size}
            maxSize={maxRoiSize}
            canvasRef={canvasRef(p.id)}
            onName={(name) => onPlayerChange(p.id, { name })}
            onCharacter={(character) => onPlayerChange(p.id, { character })}
            onSize={(size) => onPlayerChange(p.id, { crop: { ...p.crop, size } })}
          />
        ))}
      </ol>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-teal-800/60 p-2">
        <legend className="px-1 text-xs font-semibold text-teal-300">Jogador remoto (você)</legend>
        <div className="flex gap-3 text-sm text-stone-300">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="remote-mode"
              checked={remote.mode === 'crop'}
              onChange={() => onRemoteChange({ mode: 'crop' })}
            />
            Recorte da captura
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="remote-mode"
              checked={remote.mode === 'avatar'}
              onChange={() => onRemoteChange({ mode: 'avatar' })}
            />
            Avatar
          </label>
        </div>
        <SlotRow
          id="remote"
          index="R"
          color={PLAYER_COLORS.remote}
          name={remote.name}
          character={remote.character}
          size={remote.crop.size}
          maxSize={maxFrameSize}
          canvasRef={remote.mode === 'crop' ? canvasRef('remote') : undefined}
          onName={(name) => onRemoteChange({ name })}
          onCharacter={(character) => onRemoteChange({ character })}
          onSize={
            remote.mode === 'crop'
              ? (size) => onRemoteChange({ crop: { ...remote.crop, size } })
              : undefined
          }
        />
        {remote.mode === 'crop' && (
          <p className="text-xs text-stone-500">
            Posicione a moldura tracejada sobre o seu próprio vídeo no Meet, se ele aparecer na
            captura. Ela pode ficar fora da câmera coletiva.
          </p>
        )}
      </fieldset>
    </div>
  )
}

interface SlotRowProps {
  id: string
  index: string
  color: string
  name: string
  character: string
  size: number
  maxSize: number
  canvasRef: RefCallback<HTMLCanvasElement> | undefined
  onName(name: string): void
  onCharacter(character: string): void
  onSize: ((size: number) => void) | undefined
}

function SlotRow(props: SlotRowProps) {
  const { id, index, color, name, character, size, maxSize, canvasRef } = props
  const minSize = Math.min(MIN_PORTRAIT_SIZE, maxSize)
  // The slider reads as zoom: right = closer, i.e. a smaller crop.
  const invert = (v: number): number => maxSize + minSize - v
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2 rounded-lg bg-stone-900/70 p-2">
      <div
        className="relative aspect-[3/4] w-14 overflow-hidden rounded-md border-2 bg-stone-950"
        style={{ borderColor: color }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center text-sm font-bold text-stone-400"
        >
          {index}
        </span>
        {canvasRef && (
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            data-testid={`thumb-${id}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="grid grid-cols-2 gap-1">
          <input
            aria-label={`Nome ${index}`}
            value={name}
            maxLength={NAME_MAX}
            placeholder="Nome"
            onChange={(e) => props.onName(e.target.value)}
            className={inputText}
          />
          <input
            aria-label={`Personagem ${index}`}
            value={character}
            maxLength={CHARACTER_MAX}
            placeholder="Personagem (opcional)"
            onChange={(e) => props.onCharacter(e.target.value)}
            className={inputText}
          />
        </div>
        {props.onSize && (
          <label className="flex items-center gap-2 text-xs text-stone-400">
            Zoom
            <input
              type="range"
              aria-label={`Tamanho do recorte ${index}`}
              min={minSize}
              max={maxSize}
              step={0.005}
              value={invert(Math.min(size, maxSize))}
              onChange={(e) => props.onSize?.(invert(Number(e.target.value)))}
              className="w-full accent-amber-400"
              style={{ accentColor: color }}
            />
          </label>
        )}
      </div>
    </li>
  )
}
