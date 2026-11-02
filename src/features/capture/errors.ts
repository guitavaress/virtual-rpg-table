import type { CaptureError, CaptureErrorCode } from './types'

function errorName(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'name' in err && typeof err.name === 'string') {
    return err.name
  }
  return 'UnknownError'
}

function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String(err.message)
  }
  return String(err)
}

const CODE_BY_NAME: Readonly<Record<string, CaptureErrorCode>> = {
  // Chromium uses NotAllowedError both for "user cancelled the picker" and
  // "permission denied by policy", so we cannot tell them apart.
  NotAllowedError: 'denied-or-cancelled',
  // Thrown when getDisplayMedia is not called from a user gesture.
  InvalidStateError: 'no-user-gesture',
  NotSupportedError: 'unsupported',
  NotFoundError: 'source-unavailable',
  NotReadableError: 'source-busy',
  OverconstrainedError: 'overconstrained',
  AbortError: 'source-unavailable',
}

/** Maps a browser exception from getDisplayMedia (or a source) to a UI error. */
export function toCaptureError(err: unknown): CaptureError {
  const name = errorName(err)
  return {
    code: CODE_BY_NAME[name] ?? 'unknown',
    detail: `${name}: ${errorMessage(err)}`,
  }
}
