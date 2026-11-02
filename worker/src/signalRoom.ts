import { DurableObject } from 'cloudflare:workers'
import {
  isPeerRole,
  isRelayable,
  otherRole,
  type PeerNotice,
  type PeerRole,
  SIGNAL_PROTOCOL,
  sendableCloseCode,
} from './protocol'

/** A sala expira depois de 2 h sem nenhum peer conectado. */
export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000
/** Teto em bytes UTF-8. Uma oferta SDP de vídeo com candidatos fica bem abaixo disso. */
export const MAX_MESSAGE_BYTES = 64 * 1024
/** Teto de credenciais TURN por sala (cada uma vale ≈ 4 h). */
export const MAX_TURN_ISSUES = 20
/** O mínimo para a sala existir. Sem SDP, sem IP, sem nada do conteúdo. */
interface RoomMeta {
  expiresAt: number
  turnIssued: number
}

export type CreateResult = { ok: true; expiresAt: number } | { ok: false; reason: 'exists' }
export type TurnAuthorization = 'ok' | 'not-found' | 'no-peer' | 'limit'

const META_KEY = 'meta'
const OPEN = 1

/**
 * Uma sala = um Durable Object, endereçado pelo token. Troca só mensagens de
 * sinalização (SDP/ICE) entre no máximo dois peers, um de cada papel, e não
 * guarda nem registra o conteúdo. Usa a API de hibernação: sem cobrança de
 * duração enquanto os sockets ficam ociosos.
 */
export class SignalRoom extends DurableObject<Env> {
  async create(): Promise<CreateResult> {
    if (await this.readMeta()) return { ok: false, reason: 'exists' }
    const expiresAt = Date.now() + ROOM_IDLE_MS
    await this.writeMeta({ expiresAt, turnIssued: 0 })
    await this.ctx.storage.setAlarm(expiresAt)
    return { ok: true, expiresAt }
  }

  /**
   * Só recebe o upgrade de WebSocket, já filtrado (origem, token) pelo Worker.
   * Recusas voltam com o código no corpo (texto puro); o Worker põe os cabeçalhos comuns.
   */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return refuse('upgrade-required', 426)
    }
    const role = new URL(request.url).searchParams.get('role')
    if (!isPeerRole(role)) return refuse('role', 400)

    const meta = await this.readMeta()
    if (!meta) return refuse('not-found', 404)
    const peers = this.openSockets()
    if (peers.length === 0 && meta.expiresAt <= Date.now()) {
      await this.ctx.storage.deleteAll()
      return refuse('expired', 410)
    }
    // Uma vaga por papel e só dois papéis: no máximo 2 peers. Um terceiro cai aqui.
    if (this.openSockets(role).length > 0) return refuse('taken', 409)

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    this.ctx.acceptWebSocket(server, [role])
    await this.writeMeta({ ...meta, expiresAt: Date.now() + ROOM_IDLE_MS })

    const other = otherRole(role)
    for (const ws of this.openSockets(other)) {
      send(ws, { type: 'peer', role, state: 'joined' })
      send(server, { type: 'peer', role: other, state: 'joined' })
    }
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': SIGNAL_PROTOCOL },
    })
  }

  /** O Worker só pede TURN à Cloudflare depois deste "ok". */
  async authorizeTurn(): Promise<TurnAuthorization> {
    const meta = await this.readMeta()
    if (!meta) return 'not-found'
    if (this.openSockets().length === 0) return 'no-peer'
    if (meta.turnIssued >= MAX_TURN_ISSUES) return 'limit'
    await this.writeMeta({ ...meta, turnIssued: meta.turnIssued + 1 })
    return 'ok'
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') {
      ws.close(1003, 'Só texto')
      return
    }
    // length em UTF-16 é atalho barato; o teto vale em bytes UTF-8 (até 3 por unidade).
    if (message.length > MAX_MESSAGE_BYTES || utf8Length(message) > MAX_MESSAGE_BYTES) {
      ws.close(1009, 'Mensagem grande demais')
      return
    }
    if (!isRelayable(message)) {
      ws.close(1008, 'Mensagem inválida')
      return
    }
    const role = roleOf(this.ctx.getTags(ws))
    if (!role) return
    // Repasse opaco: o conteúdo não é lido além do "type" nem guardado.
    for (const peer of this.openSockets(otherRole(role))) peer.send(message)
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    await this.handleLeave(ws, sendableCloseCode(code))
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleLeave(ws, 1011)
  }

  override async alarm(): Promise<void> {
    const meta = await this.readMeta()
    if (!meta) return
    const now = Date.now()
    if (this.openSockets().length > 0) {
      await this.ctx.storage.setAlarm(now + ROOM_IDLE_MS)
    } else if (meta.expiresAt <= now) {
      await this.ctx.storage.deleteAll()
    } else {
      await this.ctx.storage.setAlarm(meta.expiresAt)
    }
  }

  private async handleLeave(ws: WebSocket, code: number): Promise<void> {
    closeQuietly(ws, code)
    const role = roleOf(this.ctx.getTags(ws))
    if (role) {
      for (const peer of this.openSockets(otherRole(role))) {
        if (peer !== ws) send(peer, { type: 'peer', role, state: 'left' })
      }
    }
    const remaining = this.openSockets().filter((peer) => peer !== ws)
    if (remaining.length > 0) return
    const meta = await this.readMeta()
    if (!meta) return
    const expiresAt = Date.now() + ROOM_IDLE_MS
    await this.writeMeta({ ...meta, expiresAt })
    await this.ctx.storage.setAlarm(expiresAt)
  }

  private openSockets(role?: PeerRole): WebSocket[] {
    return this.ctx.getWebSockets(role).filter((ws) => ws.readyState === OPEN)
  }

  private async readMeta(): Promise<RoomMeta | null> {
    const meta = await this.ctx.storage.get<RoomMeta>(META_KEY)
    return meta ?? null
  }

  private async writeMeta(meta: RoomMeta): Promise<void> {
    await this.ctx.storage.put(META_KEY, meta)
  }
}

function roleOf(tags: string[]): PeerRole | null {
  const role = tags.find(isPeerRole)
  return role ?? null
}

export type RefusalCode = 'upgrade-required' | 'role' | 'not-found' | 'expired' | 'taken'

function refuse(code: RefusalCode, status: number): Response {
  return new Response(code, { status })
}

const encoder = new TextEncoder()

function utf8Length(text: string): number {
  return encoder.encode(text).byteLength
}

function send(ws: WebSocket, notice: PeerNotice): void {
  try {
    ws.send(JSON.stringify(notice))
  } catch {
    // O socket pode ter fechado entre a checagem e o envio.
  }
}

function closeQuietly(ws: WebSocket, code: number): void {
  try {
    ws.close(code, 'Saiu')
  } catch {
    // Já fechado.
  }
}
