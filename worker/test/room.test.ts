import { env, exports } from 'cloudflare:workers'
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_MESSAGE_CHARS,
  MAX_TURN_ISSUES,
  ROOM_IDLE_MS,
  type SignalRoom,
} from '../src/signalRoom'
import worker from '../src/index'
import { generateRoomToken } from '../src/token'

const ORIGIN = 'https://app.test'
const BASE = 'https://signal.test'

interface RoomMeta {
  expiresAt: number
  turnIssued: number
}

const openSockets: WebSocket[] = []

afterEach(() => {
  for (const ws of openSockets.splice(0)) {
    try {
      ws.close(1000, 'fim do teste')
    } catch {
      // já fechado
    }
  }
})

function call(
  path: string,
  init: RequestInit = {},
  origin: string | null = ORIGIN,
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (origin) headers.set('Origin', origin)
  return exports.default.fetch(new Request(`${BASE}${path}`, { ...init, headers }))
}

async function createRoom(): Promise<{ token: string; expiresAt: number; idleTimeoutMs: number }> {
  const response = await call('/api/rooms', { method: 'POST' })
  expect(response.status).toBe(201)
  return response.json()
}

function stubFor(token: string): DurableObjectStub<SignalRoom> {
  return env.SIGNAL_ROOM.get(env.SIGNAL_ROOM.idFromName(token))
}

function readMeta(token: string): Promise<RoomMeta | undefined> {
  return runInDurableObject(stubFor(token), (_instance: SignalRoom, state) =>
    state.storage.get<RoomMeta>('meta'),
  )
}

function connectRaw(
  token: string,
  role: string,
  origin: string | null = ORIGIN,
): Promise<Response> {
  return call(
    `/api/signal?role=${role}`,
    { headers: { Upgrade: 'websocket', 'Sec-WebSocket-Protocol': `vrt-signal-v1, ${token}` } },
    origin,
  )
}

interface Peer {
  ws: WebSocket
  messages: string[]
  next: () => Promise<string>
  closed: Promise<CloseEvent>
}

async function connect(token: string, role: 'sender' | 'receiver'): Promise<Peer> {
  const response = await connectRaw(token, role)
  expect(response.status).toBe(101)
  expect(response.headers.get('Sec-WebSocket-Protocol')).toBe('vrt-signal-v1')
  const ws = response.webSocket
  if (!ws) throw new Error('sem webSocket')
  ws.accept()
  openSockets.push(ws)
  const messages: string[] = []
  const waiters: ((value: string) => void)[] = []
  ws.addEventListener('message', (event) => {
    const data = typeof event.data === 'string' ? event.data : '<binário>'
    const waiter = waiters.shift()
    if (waiter) waiter(data)
    else messages.push(data)
  })
  const closed = new Promise<CloseEvent>((resolve) => ws.addEventListener('close', resolve))
  return {
    ws,
    messages,
    closed,
    next: () => {
      const queued = messages.shift()
      return queued !== undefined
        ? Promise.resolve(queued)
        : new Promise((resolve) => waiters.push(resolve))
    },
  }
}

describe('rotas e origem', () => {
  it('health responde sem exigir origem', async () => {
    const response = await call('/api/health', {}, null)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('cria sala só para origem permitida', async () => {
    expect((await call('/api/rooms', { method: 'POST' }, null)).status).toBe(403)
    expect((await call('/api/rooms', { method: 'POST' }, 'https://evil.test')).status).toBe(403)

    const response = await call('/api/rooms', { method: 'POST' }, 'https://pr-7.preview.test')
    expect(response.status).toBe(201)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://pr-7.preview.test')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('responde ao preflight CORS só para origem permitida', async () => {
    const ok = await call('/api/turn', { method: 'OPTIONS' })
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(ok.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')

    const denied = await call('/api/turn', { method: 'OPTIONS' }, 'https://evil.test')
    expect(denied.status).toBe(403)
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('rota desconhecida dá 404', async () => {
    expect((await call('/api/nada')).status).toBe(404)
    expect((await call('/', {}, null)).status).toBe(404)
  })
})

describe('sala', () => {
  it('nasce com token de 128 bits e expira em 2 h sem peers', async () => {
    const before = Date.now()
    const room = await createRoom()
    expect(room.token).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(room.idleTimeoutMs).toBe(ROOM_IDLE_MS)
    expect(room.expiresAt).toBeGreaterThanOrEqual(before + ROOM_IDLE_MS)
    expect(room.expiresAt).toBeLessThanOrEqual(Date.now() + ROOM_IDLE_MS)

    const alarm = await runInDurableObject(stubFor(room.token), (_i: SignalRoom, state) =>
      state.storage.getAlarm(),
    )
    expect(alarm).toBe(room.expiresAt)
    expect(await readMeta(room.token)).toEqual({ expiresAt: room.expiresAt, turnIssued: 0 })
  })

  it('cada sala tem um token diferente', async () => {
    const a = await createRoom()
    const b = await createRoom()
    expect(a.token).not.toBe(b.token)
  })

  it('token que nunca foi criado não conecta e não deixa nada guardado', async () => {
    const token = generateRoomToken()
    expect((await connectRaw(token, 'sender')).status).toBe(404)
    expect(await readMeta(token)).toBeUndefined()
  })

  it('exige token no subprotocolo, papel válido, upgrade e origem', async () => {
    const { token } = await createRoom()
    const noToken = await call('/api/signal?role=sender', { headers: { Upgrade: 'websocket' } })
    expect(noToken.status).toBe(400)
    expect((await connectRaw(token, 'espectador')).status).toBe(400)
    expect((await connectRaw(token, 'sender', 'https://evil.test')).status).toBe(403)
    const noUpgrade = await call('/api/signal?role=sender', {
      headers: { 'Sec-WebSocket-Protocol': `vrt-signal-v1, ${token}` },
    })
    expect(noUpgrade.status).toBe(426)
  })
})

describe('dois peers no máximo', () => {
  it('transmissor e receptor entram e cada um sabe do outro', async () => {
    const { token } = await createRoom()
    const sender = await connect(token, 'sender')
    const receiver = await connect(token, 'receiver')

    expect(JSON.parse(await receiver.next())).toEqual({
      type: 'peer',
      role: 'sender',
      state: 'joined',
    })
    expect(JSON.parse(await sender.next())).toEqual({
      type: 'peer',
      role: 'receiver',
      state: 'joined',
    })
  })

  it('um terceiro peer é rejeitado, de qualquer papel', async () => {
    const { token } = await createRoom()
    await connect(token, 'sender')
    await connect(token, 'receiver')

    const third = await connectRaw(token, 'receiver')
    expect(third.status).toBe(409)
    expect(third.webSocket).toBeNull()
    expect((await connectRaw(token, 'sender')).status).toBe(409)
  })

  it('o mesmo papel não entra duas vezes, mesmo com a sala pela metade', async () => {
    const { token } = await createRoom()
    await connect(token, 'sender')
    expect((await connectRaw(token, 'sender')).status).toBe(409)
    await connect(token, 'receiver')
  })

  it('quando um peer sai, a vaga dele reabre e o outro é avisado', async () => {
    const { token } = await createRoom()
    const sender = await connect(token, 'sender')
    const receiver = await connect(token, 'receiver')
    await receiver.next()
    await sender.next()

    sender.ws.close(1000, 'parou')
    expect(JSON.parse(await receiver.next())).toEqual({
      type: 'peer',
      role: 'sender',
      state: 'left',
    })
    await connect(token, 'sender')
  })
})

describe('repasse de sinalização', () => {
  it('repassa a mensagem ao outro peer sem alterar', async () => {
    const { token } = await createRoom()
    const sender = await connect(token, 'sender')
    const receiver = await connect(token, 'receiver')
    await receiver.next()
    await sender.next()

    const offer = JSON.stringify({ type: 'offer', sdp: 'v=0\r\n' })
    sender.ws.send(offer)
    expect(await receiver.next()).toBe(offer)
    const answer = JSON.stringify({ type: 'answer', sdp: 'v=0\r\n' })
    receiver.ws.send(answer)
    expect(await sender.next()).toBe(answer)
  })

  it('fecha quem forja aviso do servidor', async () => {
    const { token } = await createRoom()
    const sender = await connect(token, 'sender')
    sender.ws.send(JSON.stringify({ type: 'peer', role: 'receiver', state: 'left' }))
    expect((await sender.closed).code).toBe(1008)
  })

  it('fecha quem manda mensagem grande demais', async () => {
    const { token } = await createRoom()
    const sender = await connect(token, 'sender')
    sender.ws.send(JSON.stringify({ type: 'offer', sdp: 'x'.repeat(MAX_MESSAGE_CHARS) }))
    expect((await sender.closed).code).toBe(1009)
  })

  it('fecha quem manda binário', async () => {
    const { token } = await createRoom()
    const sender = await connect(token, 'sender')
    sender.ws.send(new Uint8Array([1, 2, 3]))
    expect((await sender.closed).code).toBe(1003)
  })
})

describe('expiração', () => {
  async function forceExpired(token: string): Promise<void> {
    await runInDurableObject(stubFor(token), async (_i: SignalRoom, state) => {
      const meta = await state.storage.get<RoomMeta>('meta')
      if (!meta) throw new Error('sem meta')
      await state.storage.put('meta', { ...meta, expiresAt: Date.now() - 1 })
    })
  }

  it('sala ociosa vencida recusa conexão (410) e é apagada', async () => {
    const { token } = await createRoom()
    await forceExpired(token)

    expect((await connectRaw(token, 'sender')).status).toBe(410)
    expect(await readMeta(token)).toBeUndefined()
    expect((await connectRaw(token, 'sender')).status).toBe(404)
  })

  it('o alarme apaga a sala vencida sem peers', async () => {
    const { token } = await createRoom()
    await forceExpired(token)

    expect(await runDurableObjectAlarm(stubFor(token))).toBe(true)
    expect(await readMeta(token)).toBeUndefined()
  })

  it('o alarme não apaga sala com peer conectado (sessão longa)', async () => {
    const { token } = await createRoom()
    await connect(token, 'sender')
    await forceExpired(token)

    expect(await runDurableObjectAlarm(stubFor(token))).toBe(true)
    expect(await readMeta(token)).toBeDefined()
    const alarm = await runInDurableObject(stubFor(token), (_i: SignalRoom, state) =>
      state.storage.getAlarm(),
    )
    expect(alarm).toBeGreaterThan(Date.now())
  })

  it('o alarme adiantado reagenda para o vencimento', async () => {
    const { token, expiresAt } = await createRoom()
    expect(await runDurableObjectAlarm(stubFor(token))).toBe(true)
    expect(await readMeta(token)).toBeDefined()
    const alarm = await runInDurableObject(stubFor(token), (_i: SignalRoom, state) =>
      state.storage.getAlarm(),
    )
    expect(alarm).toBe(expiresAt)
  })

  it('a ociosidade conta de novo a partir da saída do último peer', async () => {
    const { token } = await createRoom()
    const sender = await connect(token, 'sender')
    await forceExpired(token)

    const left = Date.now()
    sender.ws.close(1000, 'parou')
    await vi.waitFor(async () => {
      const meta = await readMeta(token)
      expect(meta?.expiresAt).toBeGreaterThanOrEqual(left + ROOM_IDLE_MS)
    })
    await connect(token, 'receiver')
  })
})

describe('credenciais TURN', () => {
  function turn(token: string): Promise<Response> {
    return call('/api/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  }

  function mockCloudflare(): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      Response.json(
        {
          iceServers: [
            { urls: ['stun:stun.cloudflare.com:3478'] },
            {
              urls: ['turns:turn.cloudflare.com:443?transport=tcp'],
              username: 'u',
              credential: 'c',
            },
          ],
        },
        { status: 201 },
      ),
    )
  }

  it('sala sem peer conectado não recebe credencial', async () => {
    const spy = mockCloudflare()
    const { token } = await createRoom()
    expect((await turn(token)).status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
  })

  it('token inexistente ou malformado não recebe credencial', async () => {
    const spy = mockCloudflare()
    expect((await turn(generateRoomToken())).status).toBe(404)
    expect((await turn('curto')).status).toBe(400)
    const noBody = await call('/api/turn', { method: 'POST', body: 'não é json' })
    expect(noBody.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('com peer conectado, devolve iceServers curtos e nunca a chave', async () => {
    const spy = mockCloudflare()
    const { token } = await createRoom()
    await connect(token, 'receiver')

    const response = await turn(token)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const text = await response.text()
    expect(text).not.toContain('test-api-token')
    expect(JSON.parse(text)).toEqual({
      ttlSeconds: 14400,
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478'] },
        { urls: ['turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' },
      ],
    })
    const [url, init] = spy.mock.calls[0] ?? []
    expect(String(url)).toContain('/v1/turn/keys/test-key-id/credentials/generate-ice-servers')
    expect(new Headers((init as RequestInit | undefined)?.headers).get('Authorization')).toBe(
      'Bearer test-api-token',
    )
  })

  it(`para de emitir depois de ${MAX_TURN_ISSUES} credenciais na mesma sala`, async () => {
    mockCloudflare()
    const { token } = await createRoom()
    await connect(token, 'sender')
    for (let i = 0; i < MAX_TURN_ISSUES; i += 1) expect((await turn(token)).status).toBe(200)
    expect((await turn(token)).status).toBe(429)
  })

  it('falha da API da Cloudflare vira 502, sem detalhes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('erro interno', { status: 500 }),
    )
    const { token } = await createRoom()
    await connect(token, 'sender')
    const response = await turn(token)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'turn-upstream' })
  })

  it('sem secrets TURN (estado da produção na W1), responde 503 sem tocar na sala', async () => {
    const spy = mockCloudflare()
    const { token } = await createRoom()
    await connect(token, 'sender')
    const withoutTurn: Env = { ALLOWED_ORIGINS: env.ALLOWED_ORIGINS, SIGNAL_ROOM: env.SIGNAL_ROOM }
    const request = new Request(`${BASE}/api/turn`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    const response = await worker.fetch(request, withoutTurn)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'turn-not-configured' })
    expect(spy).not.toHaveBeenCalled()
    expect((await readMeta(token))?.turnIssued).toBe(0)
  })
})
