/**
 * Lista de origens permitidas, vinda de ALLOWED_ORIGINS (vírgulas).
 * - "https://app.exemplo.dev": origem exata.
 * - "https://*.exemplo.dev": qualquer subdomínio (não o domínio puro), só HTTPS.
 *
 * Não é autenticação (um cliente fora do navegador forja o Origin). Serve para
 * impedir que outro site use esta sinalização a partir do navegador de alguém.
 */
export interface OriginRule {
  readonly exact?: string
  readonly suffix?: string
}

export function parseAllowedOrigins(raw: string | undefined): OriginRule[] {
  if (!raw) return []
  const rules: OriginRule[] = []
  for (const part of raw.split(',')) {
    const entry = part.trim()
    if (!entry) continue
    if (entry.startsWith('https://*.')) {
      const domain = entry.slice('https://*.'.length).toLowerCase()
      if (/^[a-z0-9.-]+$/.test(domain) && domain.includes('.')) rules.push({ suffix: `.${domain}` })
      continue
    }
    const origin = toOrigin(entry)
    if (origin) rules.push({ exact: origin })
  }
  return rules
}

export function isOriginAllowed(origin: string | null, rules: readonly OriginRule[]): boolean {
  if (!origin) return false
  const normalized = toOrigin(origin)
  if (!normalized || normalized !== origin.toLowerCase()) return false
  const url = new URL(normalized)
  for (const rule of rules) {
    if (rule.exact === normalized) return true
    if (
      rule.suffix &&
      url.protocol === 'https:' &&
      url.port === '' &&
      url.hostname.endsWith(rule.suffix)
    ) {
      return true
    }
  }
  return false
}

function toOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin
  } catch {
    return null
  }
}
