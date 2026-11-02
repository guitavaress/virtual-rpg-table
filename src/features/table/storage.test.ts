import { describe, expect, it, vi } from 'vitest'
import { defaultConfig, initials, NAME_MAX } from './model'
import {
  clearTableConfig,
  loadTableConfig,
  parseTableConfig,
  saveTableConfig,
  STORAGE_KEY,
} from './storage'

describe('parseTableConfig', () => {
  it('accepts the default config (round trip through JSON)', () => {
    const config = defaultConfig()
    expect(parseTableConfig(JSON.parse(JSON.stringify(config)))).toEqual(config)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['wrong version', { ...defaultConfig(), version: 2 }],
    ['missing roi', { ...defaultConfig(), roi: undefined }],
    ['roi out of range', { ...defaultConfig(), roi: { x: -1, y: 0, width: 1, height: 1 } }],
    ['four players', { ...defaultConfig(), players: defaultConfig().players.slice(0, 4) }],
    ['player ids swapped', { ...defaultConfig(), players: [...defaultConfig().players].reverse() }],
    [
      'crop with NaN',
      {
        ...defaultConfig(),
        remote: { ...defaultConfig().remote, crop: { cx: Number.NaN, cy: 0, size: 1 } },
      },
    ],
    [
      'webcam crop with NaN',
      {
        ...defaultConfig(),
        remote: { ...defaultConfig().remote, webcamCrop: { cx: Number.NaN, cy: 0, size: 1 } },
      },
    ],
    [
      'unknown remote mode',
      { ...defaultConfig(), remote: { ...defaultConfig().remote, mode: 'x' } },
    ],
    [
      'name not a string',
      {
        ...defaultConfig(),
        players: defaultConfig().players.map((p) => ({ ...p, name: 42 })),
      },
    ],
  ])('rejects %s', (_, raw) => {
    expect(parseTableConfig(raw)).toBeNull()
  })

  it('truncates overly long names instead of rejecting', () => {
    const raw = {
      ...defaultConfig(),
      players: defaultConfig().players.map((p) => ({ ...p, name: 'x'.repeat(500) })),
    }
    expect(parseTableConfig(raw)?.players[0]?.name).toHaveLength(NAME_MAX)
  })

  it('accepts the webcam mode and keeps its own crop', () => {
    const webcamCrop = { cx: 0.4, cy: 0.3, size: 0.5 }
    const raw = {
      ...defaultConfig(),
      remote: { ...defaultConfig().remote, mode: 'webcam', webcamCrop },
    }
    expect(parseTableConfig(raw)?.remote).toMatchObject({ mode: 'webcam', webcamCrop })
  })

  it('upgrades a setup saved before the webcam mode (no webcamCrop)', () => {
    const { webcamCrop: _omit, ...oldRemote } = defaultConfig().remote
    const parsed = parseTableConfig({ ...defaultConfig(), remote: oldRemote })
    expect(parsed?.remote.webcamCrop).toEqual(defaultConfig().remote.webcamCrop)
  })

  it('ignores unknown extra fields', () => {
    const parsed = parseTableConfig({ ...defaultConfig(), sneaky: '<script>' })
    expect(parsed).not.toBeNull()
    expect(parsed).not.toHaveProperty('sneaky')
  })
})

describe('load / save / clear', () => {
  it('round-trips through localStorage and reports it as saved', () => {
    const config = { ...defaultConfig(), remote: { ...defaultConfig().remote, name: 'Gui' } }
    saveTableConfig(config)
    expect(loadTableConfig()).toEqual({ config, saved: true })
    clearTableConfig()
    expect(loadTableConfig().saved).toBe(false)
  })

  it('falls back to defaults on corrupted JSON', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadTableConfig()).toEqual({ config: defaultConfig(), saved: false })
    expect(warn).toHaveBeenCalled()
  })

  it('survives a storage that throws (blocked / quota)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(loadTableConfig(broken).saved).toBe(false)
    expect(() => saveTableConfig(defaultConfig(), broken)).not.toThrow()
    expect(() => clearTableConfig(broken)).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(3)
  })
})

describe('initials', () => {
  it.each([
    ['Ana', 'A'],
    ['ana clara', 'AC'],
    ['  Maria  da  Silva ', 'MS'],
    ['', '?'],
  ])('%j → %s', (name, expected) => {
    expect(initials(name)).toBe(expected)
  })
})
