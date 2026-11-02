/** 128 bits aleatórios em base64url sem padding: sempre 22 caracteres. */
export const TOKEN_BYTES = 16
export const TOKEN_LENGTH = 22

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function generateRoomToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/**
 * Só a forma do token. A existência e a validade da sala quem decide é o
 * Durable Object. Barrar lixo aqui evita acordar um objeto à toa.
 */
export function isWellFormedToken(value: unknown): value is string {
  if (typeof value !== 'string' || !TOKEN_RE.test(value)) return false
  // 22 caracteres base64url carregam 132 bits; os 4 bits finais são sempre zero.
  const lastIndex = BASE64URL.indexOf(value.charAt(TOKEN_LENGTH - 1))
  return (lastIndex & 0b1111) === 0
}
