import { useId, useState } from 'react'
import { useCameraDevices } from '../../features/capture/cameraDevices'
import { toCaptureError } from '../../features/capture/errors'
import type { CameraOptions, CameraQuality } from '../../features/capture/localCameraSource'
import { CAMERA_BUSY_MESSAGE, describeCaptureError } from './messages'

export interface CameraPickerProps {
  busy: boolean
  onStart(options: CameraOptions): void
  /** First button: asks the permission and lists the cameras. */
  grantLabel?: string
  /** Second button: opens the chosen camera. */
  startLabel?: string
}

const field =
  'rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-stone-100 focus-visible:ring-4 focus-visible:ring-stone-400 focus-visible:outline-none'
const button =
  'rounded-lg border border-stone-600 px-4 py-2 text-stone-200 transition hover:border-stone-400 focus-visible:ring-4 focus-visible:ring-stone-400 focus-visible:outline-none disabled:opacity-60'

/**
 * Camera labels only exist after the first permission, so the first click
 * asks and lists; the next one starts the chosen camera.
 */
export function CameraPicker({
  busy,
  onStart,
  grantLabel = 'Câmera deste computador',
  startLabel = 'Usar câmera deste computador',
}: CameraPickerProps) {
  const { devices, listed, grantAndList } = useCameraDevices()
  const [deviceId, setDeviceId] = useState('')
  const [quality, setQuality] = useState<CameraQuality>('1080p')
  const [probeError, setProbeError] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)
  const selectId = useId()
  const qualityId = useId()

  const grant = (): void => {
    setProbeError(null)
    setProbing(true)
    grantAndList()
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : ''
        setProbeError(
          name === 'NotReadableError'
            ? CAMERA_BUSY_MESSAGE
            : describeCaptureError('camera', toCaptureError(err)),
        )
      })
      .finally(() => setProbing(false))
  }

  // An id from a camera that was unplugged falls back to the default camera.
  const effectiveId = devices.some((d) => d.deviceId === deviceId) ? deviceId : ''

  return (
    <>
      {listed ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={selectId} className="text-xs text-stone-400">
              Câmera
            </label>
            <select
              id={selectId}
              value={effectiveId}
              onChange={(e) => setDeviceId(e.target.value)}
              className={field}
            >
              <option value="">Câmera padrão</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={qualityId} className="text-xs text-stone-400">
              Qualidade
            </label>
            <select
              id={qualityId}
              value={quality}
              onChange={(e) => setQuality(e.target.value === '720p' ? '720p' : '1080p')}
              className={field}
            >
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
            </select>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onStart({ deviceId: effectiveId || undefined, quality })}
            className={button}
          >
            {startLabel}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || probing}
            onClick={grant}
            className={`${button} self-start`}
          >
            {grantLabel}
          </button>
          <p className="text-xs text-stone-500">
            O primeiro clique pede a permissão da câmera e lista as câmeras disponíveis; depois você
            escolhe a câmera e a qualidade.
          </p>
        </div>
      )}
      {probeError && (
        <p role="alert" className="text-sm text-red-300">
          {probeError}
        </p>
      )}
    </>
  )
}
