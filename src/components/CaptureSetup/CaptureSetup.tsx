import { useId, type ChangeEvent, type ReactNode } from 'react'
import type { CaptureState } from '../../features/capture/types'
import { describeCaptureError, ENDED_MESSAGE } from './messages'

export interface CaptureSetupProps {
  state: CaptureState
  onSelectDisplay(): void
  onSelectFile(file: File): void
  onSelectSynthetic(): void
}

/** Screen A: explain what happens, then let the user pick a source. */
export function CaptureSetup({
  state,
  onSelectDisplay,
  onSelectFile,
  onSelectSynthetic,
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

      <StatusMessage state={state} />
    </main>
  )
}

function StatusMessage({ state }: { state: CaptureState }) {
  let content: ReactNode = null
  let tone = 'text-stone-300'

  if (state.status === 'requesting') {
    content =
      state.kind === 'display'
        ? 'Aguardando você escolher a aba ou janela no seletor do navegador…'
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

  return (
    <p role="status" aria-live="polite" className={`min-h-12 text-sm ${tone}`}>
      {content}
    </p>
  )
}
