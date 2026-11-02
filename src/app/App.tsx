import { useCallback, useEffect, useRef, useState } from 'react'
import { CalibrationView, type CalibrationStep } from '../components/Calibration/CalibrationView'
import { CaptureSetup } from '../components/CaptureSetup/CaptureSetup'
import { TableView } from '../components/VirtualTable/TableView'
import { CapturedDisplaySource } from '../features/capture/displaySource'
import { LocalCameraSource, type CameraOptions } from '../features/capture/localCameraSource'
import { LocalVideoFileSource } from '../features/capture/fileSource'
import { SyntheticTestSource } from '../features/capture/syntheticSource'
import { useCapture } from '../features/capture/useCapture'
import { defaultConfig, type TableConfig } from '../features/table/model'
import {
  clearTableConfig,
  isStorageWritable,
  loadTableConfig,
  saveTableConfig,
} from '../features/table/storage'

type View = 'calibrate' | 'table'

export function App() {
  const { state, start, stop } = useCapture()
  const [initial] = useState(loadTableConfig)
  const [config, setConfig] = useState<TableConfig>(initial.config)
  // Persisting starts at the first "Ir para a mesa" (or with an existing saved
  // setup): an unfinished calibration is never saved nor reopened as a table.
  const [persist, setPersist] = useState(initial.saved)
  const [storageWritable] = useState(() => isStorageWritable())
  // With a saved setup, the next capture opens straight on the table.
  const [view, setView] = useState<View>(initial.saved ? 'table' : 'calibrate')
  const [step, setStep] = useState<CalibrationStep>('roi')
  // True after "Reconectar" on the table: keep the table up while the picker is open.
  const [reconnecting, setReconnecting] = useState(false)
  // Options of the last camera started, so "Reconectar" reopens the same camera.
  const lastCamera = useRef<CameraOptions | null>(null)

  useEffect(() => {
    if (persist) saveTableConfig(config)
  }, [config, persist])

  const updateConfig = useCallback((update: (c: TableConfig) => TableConfig) => {
    setConfig(update)
  }, [])

  const forgetConfig = (): void => {
    clearTableConfig()
    setPersist(false)
    setConfig(defaultConfig())
    setView('calibrate')
    setStep('roi')
  }

  // Called straight from click handlers: getDisplayMedia needs the user gesture.
  const startFresh = (source: Parameters<typeof start>[0]): void => {
    setReconnecting(false)
    void start(source)
  }
  const selectDisplay = (): void => startFresh(new CapturedDisplaySource())
  const selectCamera = (options: CameraOptions): void => {
    lastCamera.current = options
    startFresh(new LocalCameraSource(options))
  }
  const selectFile = (file: File): void => startFresh(new LocalVideoFileSource(file))
  const selectSynthetic = (): void => startFresh(new SyntheticTestSource())
  const reconnect = (): void => {
    setReconnecting(true)
    const camera = lastCamera.current
    void start(
      camera && state.status !== 'idle' && state.kind === 'camera'
        ? new LocalCameraSource(camera)
        : new CapturedDisplaySource(),
    )
  }

  const tableUp =
    state.status === 'active' ||
    state.status === 'ended' ||
    (reconnecting && (state.status === 'requesting' || state.status === 'error'))

  // The table stays up when the share drops, so the user can reconnect in place.
  if (view === 'table' && tableUp) {
    return (
      <TableView
        config={config}
        capture={state}
        onCalibrate={() => {
          setStep('players')
          setView('calibrate')
        }}
        onReconnect={reconnect}
        onStop={stop}
      />
    )
  }

  if (state.status === 'active') {
    return (
      <CalibrationView
        kind={state.kind}
        label={state.label}
        media={state.media}
        config={config}
        onConfigChange={updateConfig}
        step={step}
        onStepChange={setStep}
        onGoToTable={() => {
          setPersist(true)
          setView('table')
        }}
        onSwitchDisplay={selectDisplay}
        onStop={stop}
      />
    )
  }

  return (
    <CaptureSetup
      state={state}
      hasSavedConfig={persist && storageWritable}
      onSelectDisplay={selectDisplay}
      onSelectCamera={selectCamera}
      onSelectFile={selectFile}
      onSelectSynthetic={selectSynthetic}
      onForgetConfig={forgetConfig}
    />
  )
}
