import { DEFAULT_ROI, type NormRect } from '../calibration/roi'
import { distributePortraits, regionPixels, type PortraitCrop } from '../compositor/portrait'

export const PLAYER_COUNT = 5
export const NAME_MAX = 40
export const CHARACTER_MAX = 60

export type PlayerId = 'p1' | 'p2' | 'p3' | 'p4' | 'p5'
export const PLAYER_IDS: readonly PlayerId[] = ['p1', 'p2', 'p3', 'p4', 'p5']

/** Slot accent colors (outline, nameplate, avatar). Index = slot order. */
export const PLAYER_COLORS: Readonly<Record<PlayerId | 'remote', string>> = {
  p1: '#f59e0b',
  p2: '#10b981',
  p3: '#38bdf8',
  p4: '#f43f5e',
  p5: '#a78bfa',
  remote: '#2dd4bf',
}

export interface PlayerSlot {
  readonly id: PlayerId
  readonly name: string
  readonly character: string
  /** Relative to the ROI: moving the ROI moves every player crop. */
  readonly crop: PortraitCrop
}

export type RemoteMode = 'crop' | 'avatar'

export interface RemoteSlot {
  readonly name: string
  readonly character: string
  readonly mode: RemoteMode
  /** Relative to the whole frame: the Meet self-preview is outside the ROI. */
  readonly crop: PortraitCrop
}

/** Everything the table needs. No frames, faces or biometrics, by design. */
export interface TableConfig {
  readonly version: 1
  readonly roi: NormRect
  readonly players: readonly PlayerSlot[]
  readonly remote: RemoteSlot
}

export function defaultConfig(): TableConfig {
  // Assume a 16:9 capture until the real size is known, so the default
  // frames sit side by side instead of overlapping.
  const crops = distributePortraits(
    PLAYER_COUNT,
    regionPixels(DEFAULT_ROI, { width: 1920, height: 1080 }),
  )
  return {
    version: 1,
    roi: DEFAULT_ROI,
    players: PLAYER_IDS.map((id, i) => ({
      id,
      name: `Jogador ${i + 1}`,
      character: '',
      crop: crops[i] ?? { cx: 0.5, cy: 0.5, size: 0.5 },
    })),
    remote: {
      name: 'Você',
      character: '',
      mode: 'avatar',
      crop: { cx: 0.85, cy: 0.8, size: 0.3 },
    },
  }
}

/** Up to two initials for the avatar placeholder ("Ana Clara" → "AC"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]?.[0] ?? '?'
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
