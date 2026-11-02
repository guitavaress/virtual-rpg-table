import type { RefCallback } from 'react'
import type { Size } from '../../features/calibration/roi'
import {
  clampPortrait,
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
import type { CameraOptions } from '../../features/capture/localCameraSource'
import type { CaptureState } from '../../features/capture/types'
import { CameraPicker } from '../CaptureSetup/CameraPicker'
import { describeCaptureError } from '../CaptureSetup/messages'
import { buttonSecondary, inputText } from '../ui'

type SlotPatch = Partial<Pick<PlayerSlot, 'name' | 'character' | 'crop'>>
type RemotePatch = Partial<Pick<RemoteSlot, 'name' | 'character' | 'crop' | 'webcamCrop' | 'mode'>>

export interface PlayersPanelProps {
  config: TableConfig
  video: Size
  canvasRef(id: string): RefCallback<HTMLCanvasElement>
  /** Thumbnail canvas for the remote seat (comes from the webcam or the capture). */
  remoteCanvasRef: RefCallback<HTMLCanvasElement> | undefined
  /** The remote seat's own source (this computer's webcam). */
  webcam: CaptureState
  webcamSize: Size
  onStartWebcam(options: CameraOptions): void
  onStopWebcam(): void
  onPlayerChange(id: PlayerId, patch: SlotPatch): void
  onRemoteChange(patch: RemotePatch): void
  onDistribute(): void
}

/** Side panel of step 2: live thumbnail, name, character and zoom per seat. */
export function PlayersPanel({
  config,
  video,
  canvasRef,
  remoteCanvasRef,
  webcam,
  webcamSize,
  onStartWebcam,
  onStopWebcam,
  onPlayerChange,
  onRemoteChange,
  onDistribute,
}: PlayersPanelProps) {
  const roiPx = regionPixels(config.roi, video)
  const framePx = regionPixels(FULL_FRAME, video)
  const maxRoiSize = roiPx ? maxPortraitSize(roiPx) : 1
  const maxFrameSize = framePx ? maxPortraitSize(framePx) : 1
  const remote = config.remote
  const webcamPx = regionPixels(FULL_FRAME, webcamSize)
  const maxWebcamSize = webcamPx ? maxPortraitSize(webcamPx) : 1
  const sizeable = remote.mode !== 'avatar'
  const remoteCrop = remote.mode === 'webcam' ? remote.webcamCrop : remote.crop

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
            onSize={(size) => {
              const crop = { ...p.crop, size }
              // Clamp now so the stored center is valid (no dead zone when dragging).
              onPlayerChange(p.id, { crop: roiPx ? clampPortrait(crop, roiPx) : crop })
            }}
          />
        ))}
      </ol>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-teal-800/60 p-2">
        <legend className="px-1 text-xs font-semibold text-teal-300">Jogador remoto (você)</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-stone-300">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="remote-mode"
              checked={remote.mode === 'webcam'}
              onChange={() => onRemoteChange({ mode: 'webcam' })}
            />
            Minha webcam
          </label>
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
          size={remoteCrop.size}
          maxSize={remote.mode === 'webcam' ? maxWebcamSize : maxFrameSize}
          canvasRef={remoteCanvasRef}
          onName={(name) => onRemoteChange({ name })}
          onCharacter={(character) => onRemoteChange({ character })}
          onSize={
            sizeable
              ? (size) => {
                  if (remote.mode === 'webcam') {
                    const crop = { ...remote.webcamCrop, size }
                    onRemoteChange({
                      webcamCrop: webcamPx ? clampPortrait(crop, webcamPx) : crop,
                    })
                  } else {
                    const crop = { ...remote.crop, size }
                    onRemoteChange({ crop: framePx ? clampPortrait(crop, framePx) : crop })
                  }
                }
              : undefined
          }
        />
        {remote.mode === 'webcam' && (
          <WebcamControls webcam={webcam} onStart={onStartWebcam} onStop={onStopWebcam} />
        )}
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

function WebcamControls({
  webcam,
  onStart,
  onStop,
}: {
  webcam: CaptureState
  onStart(options: CameraOptions): void
  onStop(): void
}) {
  if (webcam.status === 'active') {
    return (
      <div className="flex flex-col gap-2 text-xs text-stone-400">
        <p>
          Webcam ligada: <span data-testid="webcam-label">{webcam.label}</span>. Posicione a moldura
          sobre o seu rosto na prévia abaixo.
        </p>
        <button type="button" onClick={onStop} className={`${buttonSecondary} self-start`}>
          Desligar webcam
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-stone-500">
        A mesma webcam que você manda para o Meet. Abra este app no mesmo navegador do Meet.
      </p>
      <CameraPicker
        busy={webcam.status === 'requesting'}
        onStart={onStart}
        grantLabel="Permitir e listar câmeras"
        startLabel="Ligar minha webcam"
      />
      {webcam.status === 'error' && (
        <p role="alert" className="text-sm text-red-300">
          {describeCaptureError('camera', webcam.error)}
        </p>
      )}
      {webcam.status === 'ended' && (
        <p role="alert" className="text-sm text-amber-200">
          A webcam foi desconectada ou liberada. Ligue de novo.
        </p>
      )}
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
              aria-valuetext={`Recorte com ${Math.round(Math.min(size, maxSize) * 100)}% da altura`}
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
