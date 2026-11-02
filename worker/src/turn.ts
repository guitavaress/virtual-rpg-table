/** Credenciais TURN curtas emitidas pela Cloudflare Realtime (≈ 4 h). */
export const TURN_TTL_SECONDS = 4 * 60 * 60

export interface IceServer {
  urls: string[]
  username?: string
  credential?: string
}

export interface TurnSecrets {
  keyId: string
  apiToken: string
}

export type TurnResult =
  { ok: true; iceServers: IceServer[] } | { ok: false; reason: 'not-configured' | 'upstream' }

const KEY_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export function readTurnSecrets(env: {
  TURN_KEY_ID?: string | undefined
  TURN_KEY_API_TOKEN?: string | undefined
}): TurnSecrets | null {
  const keyId = env.TURN_KEY_ID?.trim()
  const apiToken = env.TURN_KEY_API_TOKEN?.trim()
  if (!keyId || !apiToken || !KEY_ID_RE.test(keyId)) return null
  return { keyId, apiToken }
}

/**
 * Pede credenciais à API da Cloudflare. A chave fica só aqui, no Worker: o
 * navegador recebe apenas username/credential temporários.
 */
export async function generateIceServers(
  secrets: TurnSecrets,
  fetcher: typeof fetch = fetch,
): Promise<TurnResult> {
  let response: Response
  try {
    response = await fetcher(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${secrets.keyId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secrets.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
      },
    )
  } catch {
    return { ok: false, reason: 'upstream' }
  }
  if (!response.ok) return { ok: false, reason: 'upstream' }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'upstream' }
  }
  const iceServers = parseIceServers(body)
  return iceServers ? { ok: true, iceServers } : { ok: false, reason: 'upstream' }
}

/**
 * Valida a resposta e devolve só os campos conhecidos. Remove URLs na porta 53,
 * que costumam expirar no navegador (recomendação da documentação da Cloudflare).
 */
export function parseIceServers(body: unknown): IceServer[] | null {
  if (!isRecord(body) || !Array.isArray(body.iceServers)) return null
  const servers: IceServer[] = []
  for (const raw of body.iceServers) {
    if (!isRecord(raw)) return null
    const rawUrls: unknown = raw.urls
    const list: unknown[] =
      typeof rawUrls === 'string' ? [rawUrls] : Array.isArray(rawUrls) ? rawUrls : []
    const urls = list.filter(
      (url): url is string =>
        typeof url === 'string' && /^(stun|turns?):/.test(url) && !/:53(\?|$)/.test(url),
    )
    if (urls.length === 0) continue
    const server: IceServer = { urls }
    if (typeof raw.username === 'string') server.username = raw.username
    if (typeof raw.credential === 'string') server.credential = raw.credential
    servers.push(server)
  }
  return servers.length > 0 ? servers : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
