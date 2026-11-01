import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { CaptureSession } from './captureSession'
import type { CaptureState, VideoSource } from './types'

export interface UseCapture {
  state: CaptureState
  start(source: VideoSource): Promise<void>
  stop(): void
}

/** Binds a CaptureSession to a component; stops capture on unmount. */
export function useCapture(): UseCapture {
  const [controller] = useState(() => new CaptureSession())
  const state = useSyncExternalStore(controller.subscribe, controller.getState)

  useEffect(() => () => controller.stop(), [controller])

  const start = useCallback((source: VideoSource) => controller.start(source), [controller])
  const stop = useCallback(() => controller.stop(), [controller])

  return { state, start, stop }
}
