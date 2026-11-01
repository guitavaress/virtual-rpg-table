import { useState } from 'react'
import type { AttachedMedia, SourceKind } from '../../features/capture/types'
import { RoiEditor } from '../../features/calibration/RoiEditor'
import { RoiPreview } from '../../features/calibration/RoiPreview'
import { containedRect, normToVideoPixels, type NormRect } from '../../features/calibration/roi'
import { useAttachedVideo, useVideoSize } from '../../features/calibration/useVideo'
import { useElementSize } from '../../lib/useElementSize'

const KIND_LABEL: Record<SourceKind, string> = {
  display: 'Captura do navegador',
  file: 'Vídeo local',
  synthetic: 'Fonte sintética',
}

export interface CalibrationViewProps {
  kind: SourceKind
  label: string
  media: AttachedMedia
  roi: NormRect
  onRoiChange(roi: NormRect): void
  onResetRoi(): void
  onSwitchDisplay(): void
  onStop(): void
}

/** Screen B (F0 subset): source preview, ROI editor and live crop preview. */
export function CalibrationView({
  kind,
  label,
  media,
  roi,
  onRoiChange,
  onResetRoi,
  onSwitchDisplay,
  onStop,
}: CalibrationViewProps) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  // Remembers which media failed, so a new source clears the error without an effect.
  const [failedMedia, setFailedMedia] = useState<AttachedMedia | null>(null)
  const playbackError = failedMedia === media

  const [video, videoRef] = useAttachedVideo(media)
  const videoSize = useVideoSize(video)
  const stageSize = useElementSize(stage)
  const display = containedRect(stageSize, videoSize)
  const roiPx = normToVideoPixels(roi, videoSize)

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
          <button
            type="button"
            onClick={onSwitchDisplay}
            className="rounded-lg border border-stone-600 px-3 py-2 text-sm text-stone-200 hover:border-stone-400 focus-visible:ring-4 focus-visible:ring-stone-400 focus-visible:outline-none"
          >
            {kind === 'display' ? 'Escolher outra aba/janela' : 'Usar captura do Meet'}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg bg-red-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 focus-visible:ring-4 focus-visible:ring-red-300 focus-visible:outline-none"
          >
            Parar captura
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="source-title" className="flex flex-col gap-2">
          <h2 id="source-title" className="text-sm font-semibold text-stone-300">
            Fonte original: arraste a moldura até cobrir os cinco jogadores
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
            <RoiEditor display={display} roi={roi} onChange={onRoiChange} />
          </div>
          {playbackError && (
            <p role="alert" className="text-sm text-red-300">
              O navegador não conseguiu reproduzir este vídeo (formato ou codec sem suporte).
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section aria-labelledby="preview-title" className="flex flex-col gap-2">
            <h2 id="preview-title" className="text-sm font-semibold text-stone-300">
              Prévia da região
            </h2>
            <RoiPreview video={video} roi={roi} />
          </section>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-stone-900/70 p-3 text-xs text-stone-300">
            <dt className="text-stone-500">Resolução da fonte</dt>
            <dd data-testid="source-resolution">
              {videoSize.width > 0 ? `${videoSize.width}×${videoSize.height}` : 'aguardando…'}
            </dd>
            <dt className="text-stone-500">Região (px)</dt>
            <dd>
              {roiPx.width > 0 ? `${roiPx.width}×${roiPx.height} em (${roiPx.x}, ${roiPx.y})` : '—'}
            </dd>
          </dl>

          <button
            type="button"
            onClick={onResetRoi}
            className="self-start rounded-lg border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:border-stone-400 focus-visible:ring-4 focus-visible:ring-stone-400 focus-visible:outline-none"
          >
            Redefinir região
          </button>

          <p className="text-xs text-stone-500">
            Se o Meet mudar o layout ou a câmera da mesa se mexer, ajuste a moldura de novo. A
            nitidez dos retratos depende da resolução que chega pela chamada.
          </p>
        </aside>
      </div>
    </main>
  )
}
