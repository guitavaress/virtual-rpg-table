import { describe, expect, it } from 'vitest'
import { readBodyLimited } from '../src/body'

function post(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request('https://signal.test/api/turn', { method: 'POST', body, headers })
}

describe('readBodyLimited', () => {
  it('aceita até o teto exato, contado em bytes', async () => {
    expect(await readBodyLimited(post('a'.repeat(16)), 16)).toBe('a'.repeat(16))
    expect(await readBodyLimited(post('a'.repeat(17)), 16)).toBeNull()
    // 6 caracteres "ã" = 12 bytes UTF-8.
    expect(await readBodyLimited(post('ãããããã'), 11)).toBeNull()
    expect(await readBodyLimited(post('ãããããã'), 12)).toBe('ãããããã')
  })

  it('recusa Content-Length declarado acima do teto ou inválido sem ler o corpo', async () => {
    expect(await readBodyLimited(post('{}', { 'Content-Length': '999999' }), 16)).toBeNull()
    expect(await readBodyLimited(post('{}', { 'Content-Length': 'abc' }), 16)).toBeNull()
  })

  it('recusa bytes que não são UTF-8 válido', async () => {
    expect(await readBodyLimited(post(new Uint8Array([0x7b, 0xff, 0x7d])), 16)).toBeNull()
  })

  it('corpo ausente vira texto vazio', async () => {
    expect(await readBodyLimited(post(null), 16)).toBe('')
  })
})
