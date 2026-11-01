/** Where the frames come from. Only `display` touches real meeting content. */
export type SourceKind = 'display' | 'file' | 'synthetic'

/** What a `<video>` element needs to show a source. */
export type AttachedMedia =
  | { readonly kind: 'stream'; readonly stream: MediaStream }
  | { readonly kind: 'url'; readonly url: string }

/**
 * A video source the app can attach to a `<video>` element.
 *
 * Contract:
 * - `start()` must be called from a user gesture for `display` sources.
 * - `stop()` is idempotent and must release every track / object URL it owns.
 * - `onEnded` fires only when the source ends from the outside
 *   (e.g. the browser's "Stop sharing" button), never because of `stop()`.
 */
export interface VideoSource {
  readonly kind: SourceKind
  readonly label: string
  start(): Promise<AttachedMedia>
  stop(): void
  onEnded(callback: () => void): () => void
}

export type CaptureErrorCode =
  'denied-or-cancelled' | 'no-user-gesture' | 'unsupported' | 'source-unavailable' | 'unknown'

export interface CaptureError {
  readonly code: CaptureErrorCode
  /** Raw `name: message` from the browser, for diagnostics only. */
  readonly detail: string
}

export type CaptureState =
  | { readonly status: 'idle' }
  | { readonly status: 'requesting'; readonly kind: SourceKind }
  | {
      readonly status: 'active'
      readonly kind: SourceKind
      readonly label: string
      readonly media: AttachedMedia
    }
  | { readonly status: 'ended'; readonly kind: SourceKind }
  | { readonly status: 'error'; readonly kind: SourceKind; readonly error: CaptureError }
