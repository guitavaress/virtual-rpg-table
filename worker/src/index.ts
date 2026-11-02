import { isOriginAllowed, parseAllowedOrigins } from './origin'
import { isPeerRole, tokenFromProtocols } from './protocol'
import { ROOM_IDLE_MS, type SignalRoom } from './signalRoom'
import { generateRoomToken, isWellFormedToken } from './token'
import { generateIceServers, readTurnSecrets, TURN_TTL_SECONDS } from './turn'

export { SignalRoom } from './signalRoom'

/**
 * Rotas (todas sob /api, sem estado fora do Durable Object):
 * - GET  /api/health  → "ok", sem exigir origem (checagem do deploy).
 * - POST /api/rooms   → cria sala; responde { token, expiresAt, idleTimeoutMs }.
 * - GET  /api/signal?role=sender|receiver, com upgrade de WebSocket. O token vai no
 *   cabeçalho Sec-WebSocket-Protocol ("vrt-signal-v1, <token>"), nunca na URL,
 *   para não aparecer em log de requisição.
 * - POST /api/turn    → corpo { token }; credenciais TURN curtas, só para sala com peer conectado.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const allowed = isOriginAllowed(origin, parseAllowedOrigins(env.ALLOWED_ORIGINS))
    const cors = allowed && origin ? origin : null

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json({ ok: true }, 200, null)
    }
    if (!url.pathname.startsWith('/api/')) return json({ error: 'not-found' }, 404, null)

    if (request.method === 'OPTIONS') {
      if (!cors) return json({ error: 'origin' }, 403, null)
      return new Response(null, { status: 204, headers: preflightHeaders(cors) })
    }
    if (!cors) return json({ error: 'origin' }, 403, null)

    if (url.pathname === '/api/rooms' && request.method === 'POST') return createRoom(env, cors)
    if (url.pathname === '/api/signal' && request.method === 'GET')
      return connect(request, url, env, cors)
    if (url.pathname === '/api/turn' && request.method === 'POST')
      return issueTurn(request, env, cors)
    return json({ error: 'not-found' }, 404, cors)
  },
} satisfies ExportedHandler<Env>

async function createRoom(env: Env, cors: string): Promise<Response> {
  const token = generateRoomToken()
  const result = await roomStub(env, token).create()
  if (!result.ok) return json({ error: 'conflict' }, 500, cors)
  return json({ token, expiresAt: result.expiresAt, idleTimeoutMs: ROOM_IDLE_MS }, 201, cors)
}

async function connect(request: Request, url: URL, env: Env, cors: string): Promise<Response> {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return json({ error: 'upgrade-required' }, 426, cors)
  }
  if (!isPeerRole(url.searchParams.get('role'))) return json({ error: 'role' }, 400, cors)
  const token = tokenFromProtocols(request.headers.get('Sec-WebSocket-Protocol'))
  if (!token) return json({ error: 'token' }, 400, cors)
  return roomStub(env, token).fetch(request)
}

async function issueTurn(request: Request, env: Env, cors: string): Promise<Response> {
  const token = await tokenFromBody(request)
  if (!token) return json({ error: 'token' }, 400, cors)
  // Sem TURN configurado (D-020), nem acorda a sala nem gasta o contador dela.
  const secrets = readTurnSecrets(env)
  if (!secrets) return json({ error: 'turn-not-configured' }, 503, cors)

  const authorization = await roomStub(env, token).authorizeTurn()
  if (authorization === 'not-found') return json({ error: 'not-found' }, 404, cors)
  if (authorization === 'no-peer') return json({ error: 'no-peer' }, 403, cors)
  if (authorization === 'limit') return json({ error: 'limit' }, 429, cors)

  const result = await generateIceServers(secrets)
  if (!result.ok) return json({ error: 'turn-upstream' }, 502, cors)
  return json({ iceServers: result.iceServers, ttlSeconds: TURN_TTL_SECONDS }, 200, cors)
}

function roomStub(env: Env, token: string): DurableObjectStub<SignalRoom> {
  return env.SIGNAL_ROOM.get(env.SIGNAL_ROOM.idFromName(token))
}

const MAX_BODY_CHARS = 1024

async function tokenFromBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MAX_BODY_CHARS) return null
  let text: string
  try {
    text = await request.text()
  } catch {
    return null
  }
  if (text.length > MAX_BODY_CHARS) return null
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const token: unknown = (body as { token?: unknown }).token
  return isWellFormedToken(token) ? token : null
}

function json(body: unknown, status: number, cors: string | null): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  if (cors) {
    headers.set('Access-Control-Allow-Origin', cors)
    headers.set('Vary', 'Origin')
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function preflightHeaders(cors: string): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': cors,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  })
}
