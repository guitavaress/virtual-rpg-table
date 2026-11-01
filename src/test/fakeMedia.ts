/**
 * Minimal MediaStream / MediaStreamTrack fakes for jsdom (which has neither).
 * They record stop() calls so tests can assert that nothing leaks.
 */
export class FakeTrack extends EventTarget {
  readyState: 'live' | 'ended' = 'live'
  stopCalls = 0
  readonly kind: 'video' | 'audio'
  readonly label: string

  constructor(kind: 'video' | 'audio' = 'video', label = 'Meet - Google Chrome') {
    super()
    this.kind = kind
    this.label = label
  }

  stop(): void {
    this.stopCalls++
    this.readyState = 'ended'
  }

  /** Simulates the browser ending the track ("Stop sharing" button). */
  endFromBrowser(): void {
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
}

export class FakeStream {
  private tracks: FakeTrack[]

  constructor(tracks: FakeTrack[] = [new FakeTrack()]) {
    this.tracks = [...tracks]
  }

  getTracks(): FakeTrack[] {
    return [...this.tracks]
  }

  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === 'video')
  }

  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio')
  }

  removeTrack(track: FakeTrack): void {
    this.tracks = this.tracks.filter((t) => t !== track)
  }

  get allStopped(): boolean {
    return this.tracks.every((t) => t.stopCalls > 0)
  }
}

export function asMediaStream(stream: FakeStream): MediaStream {
  return stream as unknown as MediaStream
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A getDisplayMedia provider whose calls resolve only when the test says so. */
export function controllableProvider() {
  const calls: Deferred<MediaStream>[] = []
  const options: (DisplayMediaStreamOptions | undefined)[] = []
  return {
    calls,
    options,
    provider: {
      getDisplayMedia(opts?: DisplayMediaStreamOptions): Promise<MediaStream> {
        options.push(opts)
        const d = deferred<MediaStream>()
        calls.push(d)
        return d.promise
      },
    },
  }
}

export function domError(name: string, message = name): DOMException {
  return new DOMException(message, name)
}
