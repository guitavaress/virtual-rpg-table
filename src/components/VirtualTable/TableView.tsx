import { useMemo, useState } from 'react'
import type { AttachedMedia, CaptureState } from '../../features/capture/types'
import { FULL_FRAME, portraitFrameRect } from '../../features/compositor/portrait'
import {
  usePortraitRenderer,
  type PortraitRects,
} from '../../features/compositor/usePortraitRenderer'
import { useAttachedVideo, useVideoSize } from '../../features/calibration/useVideo'
import { PLAYER_COLORS, type TableConfig } from '../../features/table/model'
import { describeCaptureError } from '../CaptureSetup/messages'
import { PlayerCard } from '../PlayerCard/PlayerCard'

export interface TableViewProps {
  config: TableConfig
  capture: CaptureState
  onCalibrate(): void
  onReconnect(): void
  onStop(): void
  /** The remote seat's own source (this computer's webcam). */
  webcam: CaptureState
  onStartWebcam(): void
}

/** Screen C: the five table portraits around a central area, plus the remote seat. */
export function TableView({
  config,
  capture,
  onCalibrate,
  onReconnect,
  onStop,
  webcam,
  onStartWebcam,
}: TableViewProps) {
  const media: AttachedMedia | null = capture.status === 'active' ? capture.media : null
  const [video, videoRef] = useAttachedVideo(media)
  // Remembers which media failed to play, so a new source clears the error.
  const [failedMedia, setFailedMedia] = useState<AttachedMedia | null>(null)
  const playbackError = media !== null && failedMedia === media
  const videoSize = useVideoSize(video)

  const rects = useMemo<PortraitRects>(() => {
    const out: Record<string, ReturnType<typeof portraitFrameRect>> = {}
    for (const p of config.players) out[p.id] = portraitFrameRect(p.crop, config.roi, videoSize)
    out.remote =
      config.remote.mode === 'crop'
        ? portraitFrameRect(config.remote.crop, FULL_FRAME, videoSize)
        : null
    return out
  }, [config, videoSize])

  const canvasRef = usePortraitRenderer(video, rects)
  const lost = media === null

  const webcamMedia: AttachedMedia | null = webcam.status === 'active' ? webcam.media : null
  const [webcamVideo, webcamVideoRef] = useAttachedVideo(webcamMedia)
  const webcamSize = useVideoSize(webcamVideo)
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
  const webcamWanted = config.remote.mode === 'webcam'
  const webcamLost = webcamWanted && webcamMedia === null

  return (
    <main className="flex min-h-screen flex-col gap-3 px-4 py-3 lg:px-8">
      {/* Frames come from this element; it stays in the DOM but out of sight. */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        loop={capture.status === 'active' && capture.kind === 'file'}
        disablePictureInPicture
        onError={() => setFailedMedia(media)}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      />

      <video
        ref={webcamVideoRef}
        muted
        playsInline
        autoPlay
        disablePictureInPicture
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-bold text-amber-300">Mesa</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCalibrate}
            disabled={lost}
            className="rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-200 hover:border-stone-400 focus-visible:ring-4 focus-visible:ring-stone-400 focus-visible:outline-none disabled:opacity-50"
          >
            Calibrar
          </button>
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 focus-visible:ring-4 focus-visible:ring-red-300 focus-visible:outline-none"
          >
            Parar captura
          </button>
        </div>
      </header>

      {playbackError && (
        <p
          role="alert"
          className="rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
        >
          O navegador não conseguiu reproduzir este vídeo (formato ou codec sem suporte). Use “Parar
          captura” e escolha outra fonte.
        </p>
      )}

      {lost && <LostSourceBanner capture={capture} onReconnect={onReconnect} onStop={onStop} />}

      {webcamLost && <WebcamBanner webcam={webcam} onStart={onStartWebcam} />}

      <div className="table-layout grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-x-6 lg:gap-y-4">
        {config.players.map((p, i) => (
          <div key={p.id} data-area={p.id} className="lg:justify-self-center">
            <PlayerCard
              name={p.name}
              character={p.character}
              color={PLAYER_COLORS[p.id]}
              canvasRef={canvasRef(p.id)}
              lost={lost}
              badge={String(i + 1)}
            />
          </div>
        ))}

        <div
          data-area="center"
          aria-hidden="true"
          className="hidden items-center rounded-[3rem] border border-amber-900/40 bg-[radial-gradient(ellipse_at_center,_#5b3a1e_0%,_#2a1a0e_70%)] px-10 shadow-inner shadow-black/60 lg:flex"
        >
          <p className="font-serif text-xl text-amber-200/40">Mesa de jogo</p>
        </div>

        <div data-area="remote" className="lg:justify-self-center">
          <PlayerCard
            name={config.remote.name}
            character={config.remote.character}
            color={PLAYER_COLORS.remote}
            canvasRef={
              config.remote.mode === 'webcam'
                ? webcamCanvasRef('remote')
                : config.remote.mode === 'crop'
                  ? canvasRef('remote')
                  : undefined
            }
            lost={config.remote.mode === 'webcam' ? webcamLost : lost}
            badge="Remoto"
          />
        </div>
      </div>
    </main>
  )
}

function WebcamBanner({ webcam, onStart }: { webcam: CaptureState; onStart(): void }) {
  let text =
    'Sua webcam não está ligada. Clique em Ligar webcam (use o mesmo navegador em que o Meet está aberto).'
  if (webcam.status === 'requesting') text = 'Abrindo a webcam…'
  if (webcam.status === 'ended') {
    text = 'A webcam foi desconectada ou liberada. Clique em Reconectar webcam.'
  }
  if (webcam.status === 'error') text = describeCaptureError('camera', webcam.error)
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-700/50 bg-teal-950/40 px-4 py-3 text-sm text-teal-100"
    >
      <p className="max-w-3xl">{text}</p>
      <button
        type="button"
        onClick={onStart}
        disabled={webcam.status === 'requesting'}
        className="rounded-lg bg-teal-300 px-3 py-1.5 font-semibold text-stone-950 hover:bg-teal-200 focus-visible:ring-4 focus-visible:ring-teal-100 focus-visible:outline-none disabled:opacity-60"
      >
        {webcam.status === 'ended' || webcam.status === 'error'
          ? 'Reconectar webcam'
          : 'Ligar webcam'}
      </button>
    </div>
  )
}

function LostSourceBanner({
  capture,
  onReconnect,
  onStop,
}: {
  capture: CaptureState
  onReconnect(): void
  onStop(): void
}) {
  let text =
    'O compartilhamento foi encerrado. A mesa e os recortes foram mantidos: clique em Reconectar e escolha a aba do Meet de novo.'
  if (capture.status === 'ended' && capture.kind === 'camera') {
    text =
      'A câmera foi desconectada ou liberada. A mesa e os recortes foram mantidos: clique em Reconectar para abrir a câmera de novo.'
  }
  if (capture.status === 'requesting')
    text =
      capture.kind === 'camera' ? 'Abrindo a câmera…' : 'Aguardando você escolher a aba ou janela…'
  if (capture.status === 'error') text = describeCaptureError(capture.kind, capture.error)

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
    >
      <p className="max-w-3xl">{text}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReconnect}
          disabled={capture.status === 'requesting'}
          className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-stone-950 hover:bg-amber-300 focus-visible:ring-4 focus-visible:ring-amber-200 focus-visible:outline-none disabled:opacity-60"
        >
          Reconectar
        </button>
        <button
          type="button"
          onClick={onStop}
          className="rounded-lg border border-stone-500 px-3 py-1.5 text-stone-200 hover:border-stone-300 focus-visible:ring-4 focus-visible:ring-stone-400 focus-visible:outline-none"
        >
          Voltar ao início
        </button>
      </div>
    </div>
  )
}
