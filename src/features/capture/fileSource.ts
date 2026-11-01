import type { AttachedMedia, VideoSource } from './types'

export type ObjectUrlApi = {
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
}

/** A local video file, for deterministic development without a real call. */
export class LocalVideoFileSource implements VideoSource {
  readonly kind = 'file'
  private readonly file: File
  private readonly urlApi: ObjectUrlApi
  private url: string | null = null

  constructor(file: File, urlApi: ObjectUrlApi = URL) {
    this.file = file
    this.urlApi = urlApi
  }

  get label(): string {
    return this.file.name
  }

  async start(): Promise<AttachedMedia> {
    // Some containers (e.g. .mkv) report an empty MIME type; let the <video> decide.
    if (this.file.type !== '' && !this.file.type.startsWith('video/')) {
      throw new DOMException(`"${this.file.name}" não é um arquivo de vídeo.`, 'NotSupportedError')
    }
    this.stop()
    this.url = this.urlApi.createObjectURL(this.file)
    return { kind: 'url', url: this.url }
  }

  stop(): void {
    if (this.url === null) return
    this.urlApi.revokeObjectURL(this.url)
    this.url = null
  }

  onEnded(): () => void {
    // The file loops; it never ends from the outside.
    return () => {}
  }
}
