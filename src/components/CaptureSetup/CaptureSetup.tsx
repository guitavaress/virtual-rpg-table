import { useId, type ChangeEvent, type ReactNode } from 'react'
import type { CameraOptions } from '../../features/capture/localCameraSource'
import type { CaptureState } from '../../features/capture/types'
import { CameraPicker } from './CameraPicker'
import { describeCaptureError, ENDED_MESSAGE } from './messages'

export interface CaptureSetupProps {
  state: CaptureState
  /** A table setup (names, crops) is saved in this browser. */
  hasSavedConfig?: boolean
  onSelectDisplay(): void
  onSelectCamera(options: CameraOptions): void
  onSelectFile(file: File): void
  onSelectSynthetic(): void
  onForgetConfig?(): void
}

/** Screen A: explain what happens, then let the user pick a source. */
export function CaptureSetup({
  state,
  hasSavedConfig = false,
  onSelectDisplay,
  onSelectCamera,
  onSelectFile,
  onSelectSynthetic,
  onForgetConfig,
}: CaptureSetupProps) {
  const fileInputId = useId()
  const busy = state.status === 'requesting'

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again still triggers a change.
    event.target.value = ''
    if (file) onSelectFile(file)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl font-bold text-amber-300">Virtual RPG Table</h1>
        <p className="text-lg text-stone-300">
          Transforma a câmera coletiva do Meet em retratos individuais da mesa.
        </p>
      </header>

      <section
        aria-labelledby="privacy-title"
        className="rounded-xl border border-stone-700 bg-stone-900/70 p-5 text-sm text-stone-300"
      >
        <h2 id="privacy-title" className="mb-2 font-semibold text-stone-100">
          Antes de começar
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            O navegador vai pedir que você escolha uma aba ou janela. Escolha a{' '}
            <strong>aba do Google Meet</strong>, não esta.
          </li>
          <li>
            O vídeo é processado só neste navegador: nada é gravado, enviado ou retransmitido.
          </li>
          <li>O áudio continua no Meet. Esta página não captura nem reproduz som.</li>
          <li>Combine com todos da mesa antes de usar a câmera deles.</li>
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onSelectDisplay}
          className="rounded-lg bg-amber-400 px-5 py-3 text-lg font-semibold text-stone-950 transition hover:bg-amber-300 focus-visible:ring-4 focus-visible:ring-amber-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
        >
          Selecionar fonte de vídeo
        </button>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label
            htmlFor={fileInputId}
            aria-disabled={busy}
            className="flex-1 cursor-pointer rounded-lg border border-stone-600 px-4 py-2 text-center text-stone-200 transition hover:border-stone-400 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-stone-400 aria-disabled:pointer-events-none aria-disabled:opacity-60"
          >
            Carregar vídeo local de teste
            <input
              id={fileInputId}
              type="file"
              accept="video/*"
              disabled={busy}
              onChange={handleFile}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={onSelectSynthetic}
            className="flex-1 rounded-lg border border-stone-600 px-4 py-2 text-stone-200 transition hover:border-stone-400 focus-visible:ring-4 focus-visible:ring-stone-400 focus-visible:outline-none disabled:opacity-60"
          >
            Usar fonte sintética de teste
          </button>
        </div>
      </div>

      <CameraSection busy={busy} onSelectCamera={onSelectCamera} />

      <StatusMessage state={state} />

      {hasSavedConfig && onForgetConfig && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
          A configuração da mesa (região, recortes e nomes) está salva neste navegador.
          <button
            type="button"
            onClick={onForgetConfig}
            className="text-stone-300 underline underline-offset-2 hover:text-stone-100"
          >
            Apagar configuração salva
          </button>
        </p>
      )}
    </main>
  )
}

function CameraSection({
  busy,
  onSelectCamera,
}: {
  busy: boolean
  onSelectCamera(options: CameraOptions): void
}) {
  return (
    <section
      aria-labelledby="camera-title"
      className="flex flex-col gap-3 rounded-xl border border-stone-700 p-4"
    >
      <h2 id="camera-title" className="text-sm font-semibold text-stone-100">
        Câmera deste computador
      </h2>
      <p className="text-xs text-stone-400">
        Usa a webcam direto, sem passar pelo Meet. Para dividir a câmera com o Meet, abra este app
        no mesmo navegador em que o Meet está aberto.
      </p>
      <CameraPicker busy={busy} onStart={onSelectCamera} />
    </section>
  )
}

function StatusMessage({ state }: { state: CaptureState }) {
  let content: ReactNode = null
  let tone = 'text-stone-300'

  if (state.status === 'requesting') {
    content =
      state.kind === 'display'
        ? 'Aguardando você escolher a aba ou janela no seletor do navegador…'
        : state.kind === 'camera'
          ? 'Abrindo a câmera… se o navegador pedir, permita o acesso.'
          : 'Carregando fonte…'
  } else if (state.status === 'ended') {
    content = ENDED_MESSAGE
    tone = 'text-amber-200'
  } else if (state.status === 'error') {
    tone = 'text-red-300'
    content = (
      <>
        {describeCaptureError(state.kind, state.error)}
        {state.error.code === 'unknown' && (
          <span className="mt-1 block font-mono text-xs opacity-80">{state.error.detail}</span>
        )}
      </>
    )
  }

  // Errors and "ended" are inserted as a fresh role="alert" so screen readers
  // announce them even when this screen mounts with the message already set.
  const urgent = state.status === 'ended' || state.status === 'error'
  return (
    <div className="min-h-12 text-sm">
      <p role="status" aria-live="polite" className={tone}>
        {urgent ? null : content}
      </p>
      {urgent && (
        <p role="alert" className={tone}>
          {content}
        </p>
      )}
    </div>
  )
}
