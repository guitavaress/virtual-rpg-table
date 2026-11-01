import { describe, expect, it, vi } from 'vitest'
import { toCaptureError } from './errors'
import { LocalVideoFileSource } from './fileSource'
import { SyntheticTestSource } from './syntheticSource'

describe('toCaptureError', () => {
  it.each([
    ['NotAllowedError', 'denied-or-cancelled'],
    ['InvalidStateError', 'no-user-gesture'],
    ['NotSupportedError', 'unsupported'],
    ['TypeError', 'unknown'],
    ['NotFoundError', 'source-unavailable'],
    ['NotReadableError', 'source-unavailable'],
    ['AbortError', 'source-unavailable'],
    ['SomethingNew', 'unknown'],
  ])('%s → %s', (name, code) => {
    expect(toCaptureError(new DOMException('x', name)).code).toBe(code)
  })

  it('handles non-Error values', () => {
    expect(toCaptureError('boom')).toEqual({ code: 'unknown', detail: 'UnknownError: boom' })
    expect(toCaptureError(new TypeError('bad'))).toEqual({
      code: 'unknown',
      detail: 'TypeError: bad',
    })
  })
})

describe('LocalVideoFileSource', () => {
  const urlApi = () => ({
    createObjectURL: vi.fn<(blob: Blob) => string>(() => 'blob:fake-1'),
    revokeObjectURL: vi.fn<(url: string) => void>(),
  })

  it('creates an object URL and revokes it once on stop', async () => {
    const api = urlApi()
    const source = new LocalVideoFileSource(new File(['x'], 'mesa.mp4', { type: 'video/mp4' }), api)
    await expect(source.start()).resolves.toEqual({ kind: 'url', url: 'blob:fake-1' })
    expect(source.label).toBe('mesa.mp4')
    source.stop()
    source.stop()
    expect(api.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(api.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1')
  })

  it('rejects non-video files without creating a URL', async () => {
    const api = urlApi()
    const source = new LocalVideoFileSource(
      new File(['x'], 'notas.txt', { type: 'text/plain' }),
      api,
    )
    await expect(source.start()).rejects.toMatchObject({ name: 'NotSupportedError' })
    expect(api.createObjectURL).not.toHaveBeenCalled()
  })

  it('accepts files with an empty MIME type (e.g. .mkv)', async () => {
    const api = urlApi()
    const source = new LocalVideoFileSource(new File(['x'], 'mesa.mkv'), api)
    await expect(source.start()).resolves.toMatchObject({ kind: 'url' })
  })
})

describe('SyntheticTestSource', () => {
  it('fails as unsupported where canvas capture is unavailable (jsdom)', async () => {
    await expect(new SyntheticTestSource().start()).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
  })
})
