import { StreamOwnership } from './streamOwnership'
import type { AttachedMedia, VideoSource } from './types'

export type CameraQuality = '1080p' | '720p'

export const CAMERA_QUALITIES: Readonly<Record<CameraQuality, { width: number; height: number }>> =
  {
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 },
  }

export interface CameraOptions {
  /** Empty/undefined = the browser's default camera. */
  deviceId?: string
  quality?: CameraQuality
}

export type CameraProvider = {
  getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>
}

export function cameraConstraints({
  deviceId,
  quality = '1080p',
}: CameraOptions): MediaStreamConstraints {
  const size = CAMERA_QUALITIES[quality]
  return {
    video: {
      // `ideal` (not `exact`) so a camera without 1080p still opens at what it has.
      ...(deviceId ? { deviceId } : {}),
      width: { ideal: size.width },
      height: { ideal: size.height },
      frameRate: { ideal: 30 },
    },
    // Audio stays in the Meet: never capture it, never play it back.
    audio: false,
  }
}

function defaultProvider(): CameraProvider | undefined {
  // `navigator.mediaDevices` is undefined on insecure origins (plain http).
  return typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
}

/** A webcam of this computer, opened with getUserMedia (no network involved). */
export class LocalCameraSource implements VideoSource {
  readonly kind = 'camera'
  private readonly ownership = new StreamOwnership()
  private trackLabel = ''

  private readonly provider: CameraProvider | undefined
  private readonly options: CameraOptions

  constructor(
    options: CameraOptions = {},
    provider: CameraProvider | undefined = defaultProvider(),
  ) {
    this.options = options
    this.provider = provider
  }

  get label(): string {
    return this.trackLabel || 'Câmera deste computador'
  }

  async start(): Promise<AttachedMedia> {
    const provider = this.provider
    if (!provider || typeof provider.getUserMedia !== 'function') {
      throw new DOMException(
        'getUserMedia não está disponível (navegador sem suporte ou origem sem HTTPS).',
        'NotSupportedError',
      )
    }
    // Must run synchronously inside the click handler.
    const stream = await provider.getUserMedia(cameraConstraints(this.options))

    // Defensive: we asked for no audio. If a browser returns some anyway, drop it.
    for (const track of stream.getAudioTracks()) {
      track.stop()
      stream.removeTrack(track)
    }

    this.ownership.adopt(stream)
    if (this.ownership.isDead) {
      this.stop()
      throw new DOMException('A câmera já foi encerrada.', 'NotFoundError')
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
