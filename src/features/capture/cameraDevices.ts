import { useCallback, useEffect, useState } from 'react'

export interface CameraDevice {
  readonly deviceId: string
  readonly label: string
}

export interface CameraDevicesProvider {
  enumerateDevices(): Promise<MediaDeviceInfo[]>
  getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>
  addEventListener?(type: 'devicechange', listener: () => void): void
  removeEventListener?(type: 'devicechange', listener: () => void): void
}

/**
 * Cameras with a readable label. Browsers hide labels (and often the ids)
 * until the page has camera permission, so an unlabeled list means "not yet".
 */
export function labeledCameras(devices: readonly MediaDeviceInfo[]): CameraDevice[] {
  return devices
    .filter((d) => d.kind === 'videoinput' && d.label !== '')
    .map((d) => ({ deviceId: d.deviceId, label: d.label }))
}

export async function listCameras(provider: CameraDevicesProvider): Promise<CameraDevice[]> {
  return labeledCameras(await provider.enumerateDevices())
}

/**
 * Asks for camera permission (call it straight from a click) and releases the
 * probe stream at once; the real source opens the camera later.
 */
export async function requestCameraPermission(provider: CameraDevicesProvider): Promise<void> {
  const stream = await provider.getUserMedia({ video: true, audio: false })
  for (const track of stream.getTracks()) track.stop()
}

export interface UseCameraDevices {
  devices: CameraDevice[]
  /** True once the browser exposed camera labels, i.e. permission was granted. */
  listed: boolean
  /** Click handler: prompts for permission, then lists. Rejects with the browser error. */
  grantAndList(): Promise<void>
}

export function useCameraDevices(
  provider: CameraDevicesProvider | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.mediaDevices,
): UseCameraDevices {
  const [devices, setDevices] = useState<CameraDevice[]>([])

  useEffect(() => {
    if (!provider || typeof provider.enumerateDevices !== 'function') return
    let cancelled = false
    // Also runs on mount: labels may already be visible from an earlier permission.
    const refresh = (): void => {
      listCameras(provider).then(
        (list) => {
          if (!cancelled) setDevices(list)
        },
        () => {
          if (!cancelled) setDevices([])
        },
      )
    }
    refresh()
    provider.addEventListener?.('devicechange', refresh)
    return () => {
      cancelled = true
      provider.removeEventListener?.('devicechange', refresh)
    }
  }, [provider])

  const grantAndList = useCallback(async (): Promise<void> => {
    if (!provider || typeof provider.getUserMedia !== 'function') {
      throw new DOMException('getUserMedia indisponível.', 'NotSupportedError')
    }
    // getUserMedia is invoked before any await: it runs inside the click.
    await requestCameraPermission(provider)
    // Re-list now that the labels are visible.
    setDevices(await listCameras(provider))
  }, [provider])

  return { devices, listed: devices.length > 0, grantAndList }
}
