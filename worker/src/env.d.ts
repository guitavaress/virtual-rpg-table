// Secrets opcionais do Worker (D-020). Ficam fora do wrangler.toml de propósito:
// sem eles o deploy funciona e /api/turn responde 503 "turn-not-configured".
declare namespace Cloudflare {
  interface Env {
    TURN_KEY_ID?: string
    TURN_KEY_API_TOKEN?: string
  }
}

interface Env {
  TURN_KEY_ID?: string
  TURN_KEY_API_TOKEN?: string
}
