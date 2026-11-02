import { useMemo, useState } from 'react'
import type { CameraOptions } from '../../features/capture/localCameraSource'
import type { AttachedMedia, CaptureState, SourceKind } from '../../features/capture/types'
import { CropEditor, type CropBox } from '../../features/calibration/CropEditor'
import { RoiEditor } from '../../features/calibration/RoiEditor'
import { RoiPreview } from '../../features/calibration/RoiPreview'
import {
  containedRect,
  DEFAULT_ROI,
  normToVideoPixels,
  type NormRect,
} from '../../features/calibration/roi'
import { useAttachedVideo, useVideoSize } from '../../features/calibration/useVideo'
import {
  distributePortraits,
  FULL_FRAME,
  portraitFrameRect,
  regionPixels,
  type PortraitCrop,
} from '../../features/compositor/portrait'
import {
  usePortraitRenderer,
  type PortraitRects,
} from '../../features/compositor/usePortraitRenderer'
import {
  PLAYER_COLORS,
  PLAYER_IDS,
  type PlayerId,
  type TableConfig,
} from '../../features/table/model'
import { useElementSize } from '../../lib/useElementSize'
import { buttonDanger, buttonPrimary, buttonSecondary } from '../ui'
import { PlayersPanel } from './PlayersPanel'

const KIND_LABEL: Record<SourceKind, string> = {
  display: 'Captura do navegador',
  camera: 'Câmera deste computador',
  file: 'Vídeo local',
  synthetic: 'Fonte sintética',
}

export type CalibrationStep = 'roi' | 'players'

export interface CalibrationViewProps {
  kind: SourceKind
  label: string
  media: AttachedMedia
  config: TableConfig
  onConfigChange(update: (config: TableConfig) => TableConfig): void
  step: CalibrationStep
  onStepChange(step: CalibrationStep): void
  onGoToTable(): void
  onSwitchDisplay(): void
  onStop(): void
  /** The remote seat's own source (this computer's webcam). */
  webcam: CaptureState
  onStartWebcam(options: CameraOptions): void
  onStopWebcam(): void
}

const isPlayerId = (id: string): id is PlayerId => (PLAYER_IDS as readonly string[]).includes(id)

/** Screen B: step 1 frames the table camera (ROI); step 2 frames each player. */
export function CalibrationView({
  kind,
  label,
  media,
  config,
  onConfigChange,
  step,
  onStepChange,
  onGoToTable,
  onSwitchDisplay,
  onStop,
  webcam,
  onStartWebcam,
  onStopWebcam,
}: CalibrationViewProps) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  // Remembers which media failed, so a new source clears the error without an effect.
  const [failedMedia, setFailedMedia] = useState<AttachedMedia | null>(null)
  const playbackError = failedMedia === media

  const [video, videoRef] = useAttachedVideo(media)
  const videoSize = useVideoSize(video)
  const stageSize = useElementSize(stage)
  const display = containedRect(stageSize, videoSize)
  const roiPx = normToVideoPixels(config.roi, videoSize)

  const rects = useMemo<PortraitRects>(() => {
    const out: Record<string, NormRect | null> = {}
    for (const p of config.players) out[p.id] = portraitFrameRect(p.crop, config.roi, videoSize)
    out.remote =
      config.remote.mode === 'crop'
        ? portraitFrameRect(config.remote.crop, FULL_FRAME, videoSize)
        : null
    return out
  }, [config, videoSize])
  const canvasRef = usePortraitRenderer(video, rects)

  // The webcam is a second, independent source that only feeds the remote seat.
  const webcamMedia = webcam.status === 'active' ? webcam.media : null
  const [webcamVideo, webcamVideoRef] = useAttachedVideo(webcamMedia)
  const webcamSize = useVideoSize(webcamVideo)
  const [webcamStage, setWebcamStage] = useState<HTMLDivElement | null>(null)
  const webcamStageSize = useElementSize(webcamStage)
  const webcamDisplay = containedRect(webcamStageSize, webcamSize)
  const webcamRects = useMemo<PortraitRects>(
    () => ({
      remote:
        config.remote.mode === 'webcam'
          ? portraitFrameRect(config.remote.webcamCrop, FULL_FRAME, webcamSize)
          : null,
    }),
    [config.remote.mode, config.remote.webcamCrop, webcamSize],
  )
  const webcamCanvasRef = usePortraitRenderer(webcamVideo, webcamRects)
  const webcamEditing = step === 'players' && config.remote.mode === 'webcam'
  const remoteCanvasRef =
    config.remote.mode === 'webcam'
      ? webcamCanvasRef('remote')
      : config.remote.mode === 'crop'
        ? canvasRef('remote')
        : undefined

  const boxes = useMemo<CropBox[]>(() => {
    const list: CropBox[] = config.players.map((p, i) => ({
      id: p.id,
      label: `${i + 1} · ${p.name}`,
      color: PLAYER_COLORS[p.id],
      crop: p.crop,
      region: 'roi',
    }))
    if (config.remote.mode === 'crop') {
      list.push({
        id: 'remote',
        label: `R · ${config.remote.name}`,
        color: PLAYER_COLORS.remote,
        crop: config.remote.crop,
        region: 'frame',
      })
    }
    return list
  }, [config])

  const webcamBoxes = useMemo<CropBox[]>(
    () => [
      {
        id: 'remote',
        label: `R · ${config.remote.name}`,
        color: PLAYER_COLORS.remote,
        crop: config.remote.webcamCrop,
        region: 'frame',
      },
    ],
    [config.remote.name, config.remote.webcamCrop],
  )

  const setRoi = (roi: NormRect): void => onConfigChange((c) => ({ ...c, roi }))

  const setCrop = (id: string, crop: PortraitCrop): void =>
    onConfigChange((c) =>
      id === 'remote'
        ? { ...c, remote: { ...c.remote, crop } }
        : isPlayerId(id)
          ? { ...c, players: c.players.map((p) => (p.id === id ? { ...p, crop } : p)) }
          : c,
    )

  const distribute = (): void =>
    onConfigChange((c) => {
      const crops = distributePortraits(c.players.length, regionPixels(c.roi, videoSize))
      return { ...c, players: c.players.map((p, i) => ({ ...p, crop: crops[i] ?? p.crop })) }
    })

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-amber-300">Calibração</h1>
          <p className="text-sm text-stone-400">
            <span className="rounded bg-stone-800 px-1.5 py-0.5 text-xs text-stone-300">
              {KIND_LABEL[kind]}
            </span>{' '}
            <span data-testid="source-label">{label}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSwitchDisplay} className={buttonSecondary}>
            {kind === 'display' ? 'Escolher outra aba/janela' : 'Usar captura do Meet'}
          </button>
          <button type="button" onClick={onStop} className={buttonDanger}>
            Parar captura
          </button>
        </div>
      </header>

      <nav aria-label="Etapas da calibração" className="flex flex-wrap items-center gap-2">
        <StepTab current={step} value="roi" onSelect={onStepChange}>
          1. Câmera coletiva
        </StepTab>
        <StepTab current={step} value="players" onSelect={onStepChange}>
          2. Jogadores
        </StepTab>
        <span className="flex-1" />
        {step === 'roi' ? (
          <button type="button" onClick={() => onStepChange('players')} className={buttonPrimary}>
            Próximo: jogadores
          </button>
        ) : (
          <button type="button" onClick={onGoToTable} className={buttonPrimary}>
            Ir para a mesa
          </button>
        )}
      </nav>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="source-title" className="flex flex-col gap-2">
          <h2 id="source-title" className="text-sm font-semibold text-stone-300">
            {step === 'roi'
              ? 'Fonte original: arraste a moldura até cobrir a câmera coletiva com os cinco jogadores'
              : 'Posicione um recorte em cada jogador (os recortes acompanham a câmera coletiva)'}
          </h2>
          <div
            ref={setStage}
            className="relative aspect-video w-full overflow-hidden rounded-xl bg-black"
          >
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              loop={kind === 'file'}
              disablePictureInPicture
              onError={() => setFailedMedia(media)}
              className="absolute inset-0 h-full w-full object-contain"
            />
            {step === 'roi' ? (
              <RoiEditor display={display} roi={config.roi} onChange={setRoi} />
            ) : (
              <CropEditor
                display={display}
                video={videoSize}
                roi={config.roi}
                boxes={boxes}
                onChange={setCrop}
              />
            )}
          </div>
          {playbackError && (
            <p role="alert" className="text-sm text-red-300">
              O navegador não conseguiu reproduzir este vídeo (formato ou codec sem suporte).
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {step === 'roi' ? (
            <>
              <section aria-labelledby="preview-title" className="flex flex-col gap-2">
                <h2 id="preview-title" className="text-sm font-semibold text-stone-300">
                  Prévia da região
                </h2>
                <RoiPreview video={video} roi={config.roi} />
              </section>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-stone-900/70 p-3 text-xs text-stone-300">
                <dt className="text-stone-500">Resolução da fonte</dt>
                <dd data-testid="source-resolution">
                  {videoSize.width > 0 ? `${videoSize.width}×${videoSize.height}` : 'aguardando…'}
                </dd>
                {kind === 'camera' && (
                  <>
                    <dt className="text-stone-500">Entregue pela câmera</dt>
                    <dd data-testid="track-resolution">{describeTrackSettings(media)}</dd>
                  </>
                )}
                <dt className="text-stone-500">Região (px)</dt>
                <dd>
                  {roiPx.width > 0
                    ? `${roiPx.width}×${roiPx.height} em (${roiPx.x}, ${roiPx.y})`
                    : '—'}
                </dd>
              </dl>
              <button
                type="button"
                onClick={() => setRoi(DEFAULT_ROI)}
                className={`${buttonSecondary} self-start`}
              >
                Redefinir região
              </button>
              <p className="text-xs text-stone-500">
                Se o Meet mudar o layout ou a câmera da mesa se mexer, ajuste a moldura de novo. A
                nitidez dos retratos depende da resolução que chega pela chamada.
              </p>
            </>
          ) : (
            <PlayersPanel
              config={config}
              video={videoSize}
              canvasRef={canvasRef}
              remoteCanvasRef={remoteCanvasRef}
              webcam={webcam}
              webcamSize={webcamSize}
              onStartWebcam={onStartWebcam}
              onStopWebcam={onStopWebcam}
              onPlayerChange={(id, patch) =>
                onConfigChange((c) => ({
                  ...c,
                  players: c.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
                }))
              }
              onRemoteChange={(patch) =>
                onConfigChange((c) => ({ ...c, remote: { ...c.remote, ...patch } }))
              }
              onDistribute={distribute}
            />
          )}
          {/* Always mounted so the webcam frames keep flowing to the portrait; only shown while editing. */}
          <section
            aria-label="Prévia da sua webcam"
            className={
              webcamEditing
                ? 'flex flex-col gap-2'
                : 'pointer-events-none fixed top-0 left-0 h-px w-px opacity-0'
            }
          >
            {webcamEditing && <h2 className="text-sm font-semibold text-stone-300">Sua webcam</h2>}
            <div
              ref={setWebcamStage}
              className="relative aspect-video w-full overflow-hidden rounded-xl bg-black"
            >
              <video
                ref={webcamVideoRef}
                muted
                playsInline
                autoPlay
                disablePictureInPicture
                data-testid="webcam-video"
                className="absolute inset-0 h-full w-full object-contain"
              />
              {webcamEditing && webcamMedia && (
                <CropEditor
                  display={webcamDisplay}
                  video={webcamSize}
                  roi={FULL_FRAME}
                  boxes={webcamBoxes}
                  onChange={(_, crop) =>
                    onConfigChange((c) => ({ ...c, remote: { ...c.remote, webcamCrop: crop } }))
                  }
                />
              )}
            </div>
            {webcamEditing && webcamMedia && (
              <p className="text-xs text-stone-500">
                Resolução entregue:{' '}
                <span data-testid="webcam-resolution">{describeTrackSettings(webcamMedia)}</span>
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  )
}

/** What `track.getSettings()` says the camera really delivers (the spike's key measurement). */
function describeTrackSettings(media: AttachedMedia): string {
  if (media.kind !== 'stream') return '—'
  const settings = media.stream.getVideoTracks()[0]?.getSettings?.()
  if (!settings?.width || !settings.height) return 'indisponível'
  const fps = settings.frameRate ? ` a ${Math.round(settings.frameRate)} fps` : ''
  return `${settings.width}×${settings.height}${fps}`
}

function StepTab({
  current,
  value,
  onSelect,
  children,
}: {
  current: CalibrationStep
  value: CalibrationStep
  onSelect(step: CalibrationStep): void
  children: string
}) {
  const active = current === value
  return (
    <button
      type="button"
      aria-current={active ? 'step' : undefined}
      onClick={() => onSelect(value)}
      className={`rounded-full px-3 py-1 text-sm transition focus-visible:ring-4 focus-visible:ring-amber-200 focus-visible:outline-none ${
        active
          ? 'bg-amber-400/20 font-semibold text-amber-200'
          : 'text-stone-400 hover:text-stone-200'
      }`}
    >
      {children}
    </button>
  )
}
