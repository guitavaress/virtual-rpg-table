/**
 * Lê o corpo como texto UTF-8 parando assim que passa de `maxBytes`, mesmo sem
 * Content-Length (envio em pedaços). Devolve null se passar do teto ou não for UTF-8.
 */
export async function readBodyLimited(request: Request, maxBytes: number): Promise<string | null> {
  const declared = request.headers.get('Content-Length')
  if (declared !== null && !(Number(declared) <= maxBytes)) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
  } catch {
    return null
  }
}
