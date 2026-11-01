import { useState } from 'react'
import { CalibrationView } from '../components/Calibration/CalibrationView'
import { CaptureSetup } from '../components/CaptureSetup/CaptureSetup'
import { DEFAULT_ROI, type NormRect } from '../features/calibration/roi'
import { CapturedDisplaySource } from '../features/capture/displaySource'
import { LocalVideoFileSource } from '../features/capture/fileSource'
import { SyntheticTestSource } from '../features/capture/syntheticSource'
import { useCapture } from '../features/capture/useCapture'

export function App() {
  const { state, start, stop } = useCapture()
  // Kept across source switches/ends: normalized, so it stays valid.
  const [roi, setRoi] = useState<NormRect>(DEFAULT_ROI)

  // Called straight from click handlers: getDisplayMedia needs the user gesture.
  const selectDisplay = (): void => void start(new CapturedDisplaySource())
  const selectFile = (file: File): void => void start(new LocalVideoFileSource(file))
  const selectSynthetic = (): void => void start(new SyntheticTestSource())

  if (state.status === 'active') {
    return (
      <CalibrationView
        kind={state.kind}
        label={state.label}
        media={state.media}
        roi={roi}
        onRoiChange={setRoi}
        onResetRoi={() => setRoi(DEFAULT_ROI)}
        onSwitchDisplay={selectDisplay}
        onStop={stop}
      />
    )
  }

  return (
    <CaptureSetup
      state={state}
      onSelectDisplay={selectDisplay}
      onSelectFile={selectFile}
      onSelectSynthetic={selectSynthetic}
    />
  )
}
