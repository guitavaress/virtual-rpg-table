import { clampRect, type NormRect } from '../calibration/roi'
import type { PortraitCrop } from '../compositor/portrait'
import {
  CHARACTER_MAX,
  defaultConfig,
  NAME_MAX,
  PLAYER_IDS,
  type PlayerSlot,
  type RemoteSlot,
  type TableConfig,
} from './model'

export const STORAGE_KEY = 'virtual-rpg-table/config/v1'

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const isUnit = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

function parseRect(v: unknown): NormRect | null {
  if (!isObject(v)) return null
  const { x, y, width, height } = v
  if (!isUnit(x) || !isUnit(y) || !isUnit(width) || !isUnit(height)) return null
  return clampRect({ x, y, width, height })
}

function parseCrop(v: unknown): PortraitCrop | null {
  if (!isObject(v)) return null
  const { cx, cy, size } = v
  if (!isUnit(cx) || !isUnit(cy) || !isUnit(size) || size === 0) return null
  return { cx, cy, size }
}

function parseText(v: unknown, max: number): string | null {
  return typeof v === 'string' ? v.slice(0, max) : null
}

function parsePlayers(v: unknown): PlayerSlot[] | null {
  if (!Array.isArray(v) || v.length !== PLAYER_IDS.length) return null
  const players: PlayerSlot[] = []
  for (const [i, id] of PLAYER_IDS.entries()) {
    const p: unknown = v[i]
    if (!isObject(p) || p.id !== id) return null
    const name = parseText(p.name, NAME_MAX)
    const character = parseText(p.character, CHARACTER_MAX)
    const crop = parseCrop(p.crop)
    if (name === null || character === null || !crop) return null
    players.push({ id, name, character, crop })
  }
  return players
}

function parseRemote(v: unknown): RemoteSlot | null {
  if (!isObject(v)) return null
  const name = parseText(v.name, NAME_MAX)
  const character = parseText(v.character, CHARACTER_MAX)
  const crop = parseCrop(v.crop)
  const mode = v.mode === 'crop' || v.mode === 'avatar' ? v.mode : null
  if (name === null || character === null || !crop || !mode) return null
  return { name, character, mode, crop }
}

/** Validates untrusted JSON (storage today, file import in F3). Null if invalid. */
export function parseTableConfig(raw: unknown): TableConfig | null {
  if (!isObject(raw) || raw.version !== 1) return null
  const roi = parseRect(raw.roi)
  const players = parsePlayers(raw.players)
  const remote = parseRemote(raw.remote)
  if (!roi || !players || !remote) return null
  return { version: 1, roi, players, remote }
}

export interface LoadedConfig {
  config: TableConfig
  /** True when a valid saved config was found. */
  saved: boolean
}

export function loadTableConfig(storage: Storage | undefined = safeStorage()): LoadedConfig {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    if (text) {
      const config = parseTableConfig(JSON.parse(text))
      if (config) return { config, saved: true }
      console.warn('Configuração salva inválida; usando o padrão.')
    }
  } catch (err) {
    console.warn('Não foi possível ler a configuração salva; usando o padrão.', err)
  }
  return { config: defaultConfig(), saved: false }
}

export function saveTableConfig(
  config: TableConfig,
  storage: Storage | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch (err) {
    // Quota or privacy mode: the session still works, it just won't persist.
    console.warn('Não foi possível salvar a configuração.', err)
  }
}

export function clearTableConfig(storage: Storage | undefined = safeStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Não foi possível apagar a configuração salva.', err)
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    // Accessing localStorage itself can throw when storage is blocked.
    return undefined
  }
}
