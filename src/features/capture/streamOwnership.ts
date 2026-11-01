import { Emitter } from '../../lib/emitter'

/**
 * Owns a MediaStream: watches its tracks for external `ended` events and
 * guarantees every track is stopped exactly when `release()` runs.
 */
export class StreamOwnership {
  private readonly ended = new Emitter()
  private stream: MediaStream | null = null
  private notified = false

  private readonly handleTrackEnded = (): void => {
    if (this.notified) return
    this.notified = true
    this.ended.emit()
  }

  adopt(stream: MediaStream): void {
    this.release()
    this.stream = stream
    this.notified = false
    for (const track of stream.getTracks()) {
      track.addEventListener('ended', this.handleTrackEnded)
    }
  }

  release(): void {
    const stream = this.stream
    if (!stream) return
    this.stream = null
    for (const track of stream.getTracks()) {
      track.removeEventListener('ended', this.handleTrackEnded)
      track.stop()
    }
  }

  onEnded(callback: () => void): () => void {
    return this.ended.on(callback)
  }
}
