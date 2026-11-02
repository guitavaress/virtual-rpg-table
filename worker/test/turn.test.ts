import { describe, expect, it, vi } from 'vitest'
import { generateIceServers, parseIceServers, readTurnSecrets, TURN_TTL_SECONDS } from '../src/turn'

const secrets = { keyId: 'key-123', apiToken: 'segredo-nao-vaza' }

const cloudflareResponse = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:53?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
        'turns:turn.cloudflare.com:443?transport=tcp',
      ],
      username: 'user-curto',
      credential: 'cred-curta',
      extra: 'descartado',
    },
  ],
}

describe('credenciais TURN', () => {
  it('chama a API da Cloudflare com a chave do Worker e TTL de 4 h', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(cloudflareResponse, { status: 201 }),
    )
    const result = await generateIceServers(secrets, fetcher)

    expect(result.ok).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(url).toBe(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key-123/credentials/generate-ice-servers',
    )
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer segredo-nao-vaza')
    expect(JSON.parse(String(init?.body))).toEqual({ ttl: TURN_TTL_SECONDS })
    expect(TURN_TTL_SECONDS).toBe(14400)
  })

  it('devolve só username/credential temporários, sem a chave e sem porta 53', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(cloudflareResponse, { status: 201 }),
    )
    const result = await generateIceServers(secrets, fetcher)
    if (!result.ok) throw new Error('esperava ok')

    expect(JSON.stringify(result)).not.toContain('segredo-nao-vaza')
    expect(JSON.stringify(result)).not.toMatch(/:53[?"]/)
    expect(JSON.stringify(result)).not.toContain('descartado')
    expect(result.iceServers).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turn:turn.cloudflare.com:3478?transport=tcp',
          'turns:turn.cloudflare.com:5349?transport=tcp',
          'turns:turn.cloudflare.com:443?transport=tcp',
        ],
        username: 'user-curto',
        credential: 'cred-curta',
      },
    ])
  })

  it.each([
    ['HTTP 401', async () => new Response('não', { status: 401 })],
    ['corpo que não é JSON', async () => new Response('<html>', { status: 201 })],
    ['JSON sem iceServers', async () => Response.json({ ok: true }, { status: 201 })],
    [
      'falha de rede',
      async (): Promise<Response> => {
        throw new TypeError('rede')
      },
    ],
  ])('vira erro "upstream" com %s', async (_label, impl) => {
    const result = await generateIceServers(secrets, vi.fn<typeof fetch>(impl))
    expect(result).toEqual({ ok: false, reason: 'upstream' })
  })

  it('rejeita resposta com URL de esquema desconhecido', () => {
    expect(parseIceServers({ iceServers: [{ urls: ['https://evil.test'] }] })).toBeNull()
    expect(parseIceServers({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] })).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
    ])
  })

  it('sem secrets configurados, não há credencial', () => {
    expect(readTurnSecrets({})).toBeNull()
    expect(readTurnSecrets({ TURN_KEY_ID: 'abc', TURN_KEY_API_TOKEN: '' })).toBeNull()
    expect(readTurnSecrets({ TURN_KEY_ID: '../x', TURN_KEY_API_TOKEN: 'tok' })).toBeNull()
    expect(readTurnSecrets({ TURN_KEY_ID: ' abc ', TURN_KEY_API_TOKEN: ' tok ' })).toEqual({
      keyId: 'abc',
      apiToken: 'tok',
    })
  })
})
