import { toCaptureError } from './errors'
import type { AttachedMedia, CaptureState, VideoSource } from './types'

type Listener = (state: CaptureState) => void

/**
 * Framework-free owner of "the current video source".
 *
 * Invariants:
 * - At most one source is active; starting a new one releases the old one first.
 * - A request that resolves after `stop()` (or after a newer `start()`) is
 *   released immediately: a generation counter marks it as stale.
 * - Every exit path (stop, switch, browser "Stop sharing", failure) releases tracks.
 */
export class CaptureSession {
  private state: CaptureState = { status: 'idle' }
  private current: VideoSource | null = null
  private unsubscribeEnded: (() => void) | null = null
  private generation = 0
  private readonly listeners = new Set<Listener>()

  readonly getState = (): CaptureState => this.state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Starts `source`. For display sources call this directly from the click
   * handler: `source.start()` runs before the first `await`, which keeps the
   * browser's user-activation requirement satisfied.
   */
  async start(source: VideoSource): Promise<void> {
    this.releaseCurrent()
    const generation = ++this.generation
    this.setState({ status: 'requesting', kind: source.kind })

    let media: AttachedMedia
    try {
      media = await source.start()
    } catch (err) {
      source.stop()
      if (generation === this.generation) {
        this.setState({ status: 'error', kind: source.kind, error: toCaptureError(err) })
      }
      return
    }

    if (generation !== this.generation) {
      // Superseded by stop() or by a newer start(): do not leak the late stream.
      source.stop()
      return
    }

    this.current = source
    this.unsubscribeEnded = source.onEnded(() => {
      if (this.current !== source) return
      this.releaseCurrent()
      this.setState({ status: 'ended', kind: source.kind })
    })
    this.setState({ status: 'active', kind: source.kind, label: source.label, media })
  }

  /** Releases everything and returns to idle. Safe to call at any time. */
  stop(): void {
    this.generation++
    this.releaseCurrent()
    if (this.state.status !== 'idle') this.setState({ status: 'idle' })
  }

  private releaseCurrent(): void {
    this.unsubscribeEnded?.()
    this.unsubscribeEnded = null
    this.current?.stop()
    this.current = null
  }

  private setState(next: CaptureState): void {
    this.state = next
    for (const listener of [...this.listeners]) listener(next)
  }
}
