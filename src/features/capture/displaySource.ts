import { StreamOwnership } from './streamOwnership'
import type { AttachedMedia, VideoSource } from './types'

/**
 * Chromium-specific hints that are not yet in TypeScript's DOM lib.
 * Browsers that do not know them simply ignore them.
 */
export type DisplayMediaOptions = DisplayMediaStreamOptions & {
  /** Hide the VTT tab itself from the picker to avoid visual recursion. */
  selfBrowserSurface?: 'include' | 'exclude'
  /** Let the user switch the shared tab from the browser's sharing bar. */
  surfaceSwitching?: 'include' | 'exclude'
  systemAudio?: 'include' | 'exclude'
}

export const DISPLAY_MEDIA_OPTIONS: Readonly<DisplayMediaOptions> = {
  video: { frameRate: { ideal: 30 } },
  // Audio stays in the Meet: never capture it, never play it back.
  audio: false,
  systemAudio: 'exclude',
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
}

export type DisplayMediaProvider = {
  getDisplayMedia(options?: DisplayMediaStreamOptions): Promise<MediaStream>
}

function defaultProvider(): DisplayMediaProvider | undefined {
  // `navigator.mediaDevices` is undefined on insecure origins (plain http).
  return typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
}

/** A tab / window / screen chosen by the user in the browser's own picker. */
export class CapturedDisplaySource implements VideoSource {
  readonly kind = 'display'
  private readonly ownership = new StreamOwnership()
  private trackLabel = ''

  private readonly provider: DisplayMediaProvider | undefined

  constructor(provider: DisplayMediaProvider | undefined = defaultProvider()) {
    this.provider = provider
  }

  get label(): string {
    return this.trackLabel || 'Aba/janela compartilhada'
  }

  async start(): Promise<AttachedMedia> {
    const provider = this.provider
    if (!provider || typeof provider.getDisplayMedia !== 'function') {
      throw new DOMException(
        'getDisplayMedia não está disponível (navegador sem suporte ou origem sem HTTPS).',
        'NotSupportedError',
      )
    }
    // Must run synchronously inside the click handler (transient activation).
    const stream = await provider.getDisplayMedia(DISPLAY_MEDIA_OPTIONS)

    // Defensive: we asked for no audio. If a browser returns some anyway, drop it.
    for (const track of stream.getAudioTracks()) {
      track.stop()
      stream.removeTrack(track)
    }

    this.ownership.adopt(stream)
    if (this.ownership.isDead) {
      // No `ended` event will ever fire for a track that is already ended.
      this.stop()
      throw new DOMException('A fonte escolhida já terminou.', 'NotReadableError')
    }
    this.trackLabel = stream.getVideoTracks()[0]?.label ?? ''
    return { kind: 'stream', stream }
  }

  stop(): void {
    this.ownership.release()
  }

  onEnded(callback: () => void): () => void {
    return this.ownership.onEnded(callback)
  }
}
