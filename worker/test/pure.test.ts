import { describe, expect, it } from 'vitest'
import { isOriginAllowed, parseAllowedOrigins } from '../src/origin'
import { isRelayable, sendableCloseCode, tokenFromProtocols } from '../src/protocol'
import { generateRoomToken, isWellFormedToken, TOKEN_LENGTH } from '../src/token'

describe('token da sala', () => {
  it('tem 128 bits em base64url (22 caracteres) e passa na validação', () => {
    const token = generateRoomToken()
    expect(token).toHaveLength(TOKEN_LENGTH)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(isWellFormedToken(token)).toBe(true)
  })

  it('não se repete em 2.000 sorteios', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i += 1) seen.add(generateRoomToken())
    expect(seen.size).toBe(2000)
  })

  it('decodifica para exatamente 16 bytes', () => {
    const token = generateRoomToken()
    const binary = atob(token.replaceAll('-', '+').replaceAll('_', '/') + '==')
    expect(binary).toHaveLength(16)
  })

  it.each([
    ['curto', 'A'.repeat(21)],
    ['longo', 'A'.repeat(23)],
    ['caractere fora do base64url', 'A'.repeat(21) + '='],
    ['barra', 'A'.repeat(10) + '/' + 'A'.repeat(11)],
    ['bits finais diferentes de zero', 'A'.repeat(21) + 'B'],
    ['vazio', ''],
  ])('rejeita token %s', (_label, value) => {
    expect(isWellFormedToken(value)).toBe(false)
  })

  it('rejeita o que não é string', () => {
    expect(isWellFormedToken(undefined)).toBe(false)
    expect(isWellFormedToken(42)).toBe(false)
    expect(isWellFormedToken({ token: 'x' })).toBe(false)
  })
})

describe('origens permitidas', () => {
  const rules = parseAllowedOrigins(
    ' https://app.test , https://*.preview.test, http://localhost:5173, lixo, https://*.x',
  )

  it('aceita a origem exata', () => {
    expect(isOriginAllowed('https://app.test', rules)).toBe(true)
    expect(isOriginAllowed('http://localhost:5173', rules)).toBe(true)
  })

  it('aceita subdomínio HTTPS do curinga, mas não o domínio puro', () => {
    expect(isOriginAllowed('https://abc123.preview.test', rules)).toBe(true)
    expect(isOriginAllowed('https://a.b.preview.test', rules)).toBe(true)
    expect(isOriginAllowed('https://preview.test', rules)).toBe(false)
  })

  it.each([
    null,
    '',
    'null',
    'https://evil.test',
    'https://app.test.evil.test',
    'https://evilpreview.test',
    'http://abc.preview.test',
    'https://abc.preview.test:8443',
    'http://localhost:5174',
    'https://app.test/caminho',
  ])('rejeita %s', (origin) => {
    expect(isOriginAllowed(origin, rules)).toBe(false)
  })

  it('lista vazia não aceita nada', () => {
    expect(isOriginAllowed('https://app.test', parseAllowedOrigins(undefined))).toBe(false)
    expect(isOriginAllowed('https://app.test', parseAllowedOrigins(''))).toBe(false)
  })
})

describe('protocolo', () => {
  const token = generateRoomToken()

  it('lê o token do subprotocolo do WebSocket', () => {
    expect(tokenFromProtocols(`vrt-signal-v1, ${token}`)).toBe(token)
    expect(tokenFromProtocols(`vrt-signal-v1,${token}`)).toBe(token)
  })

  it.each([
    null,
    'vrt-signal-v1',
    `${token}, vrt-signal-v1`,
    `outro, ${token}`,
    `vrt-signal-v1, ${token}, extra`,
    'vrt-signal-v1, curto',
  ])('rejeita o cabeçalho %s', (header) => {
    expect(tokenFromProtocols(header)).toBeNull()
  })

  it('repassa só objeto JSON com "type", e nunca o "peer" do servidor', () => {
    expect(isRelayable('{"type":"offer","sdp":"v=0"}')).toBe(true)
    expect(isRelayable('{"type":"peer","role":"sender","state":"left"}')).toBe(false)
    expect(isRelayable('{"type":""}')).toBe(false)
    expect(isRelayable('{"sdp":"v=0"}')).toBe(false)
    expect(isRelayable('[{"type":"offer"}]')).toBe(false)
    expect(isRelayable('"offer"')).toBe(false)
    expect(isRelayable('não é json')).toBe(false)
  })

  it('não tenta enviar códigos de fechamento reservados', () => {
    expect(sendableCloseCode(1000)).toBe(1000)
    expect(sendableCloseCode(1001)).toBe(1001)
    expect(sendableCloseCode(1005)).toBe(1000)
    expect(sendableCloseCode(1006)).toBe(1000)
    expect(sendableCloseCode(1015)).toBe(1000)
    expect(sendableCloseCode(4000)).toBe(4000)
    expect(sendableCloseCode(42)).toBe(1000)
  })
})
