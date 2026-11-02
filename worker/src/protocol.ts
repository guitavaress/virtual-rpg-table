import { isWellFormedToken } from './token'

/** Subprotocolo do WebSocket. O token vai como segundo item, nunca na URL. */
export const SIGNAL_PROTOCOL = 'vrt-signal-v1'

export type PeerRole = 'sender' | 'receiver'

export function isPeerRole(value: unknown): value is PeerRole {
  return value === 'sender' || value === 'receiver'
}

export function otherRole(role: PeerRole): PeerRole {
  return role === 'sender' ? 'receiver' : 'sender'
}

/** "vrt-signal-v1, <token>": exatamente dois itens, nessa ordem. */
export function tokenFromProtocols(header: string | null): string | null {
  if (!header) return null
  const parts = header.split(',').map((part) => part.trim())
  if (parts.length !== 2 || parts[0] !== SIGNAL_PROTOCOL) return null
  const token = parts[1]
  return isWellFormedToken(token) ? token : null
}

/** Mensagem que só o servidor emite; um peer não pode forjá-la. */
export interface PeerNotice {
  type: 'peer'
  role: PeerRole
  state: 'joined' | 'left'
}

/** Objeto JSON com "type" string, e nunca o "peer" reservado ao servidor. */
export function isRelayable(message: string): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(message)
  } catch {
    return false
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false
  const type: unknown = (parsed as { type?: unknown }).type
  return typeof type === 'string' && type.length > 0 && type !== 'peer'
}

/** 1005, 1006 e 1015 só existem no lado de quem recebe; não podem ser enviados. */
export function sendableCloseCode(code: number): number {
  if (code === 1000 || (code >= 1001 && code <= 1014 && code !== 1005 && code !== 1006)) return code
  return code >= 3000 && code <= 4999 ? code : 1000
}
