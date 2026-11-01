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

  /** True when the stream has no live video track (e.g. the tab closed while the picker was open). */
  get isDead(): boolean {
    const video = this.stream?.getVideoTracks() ?? []
    return video.length === 0 || video.some((track) => track.readyState === 'ended')
  }

  onEnded(callback: () => void): () => void {
    return this.ended.on(callback)
  }
}
