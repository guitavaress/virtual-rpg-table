/** Minimal listener set used by sources to signal external events. */
export class Emitter {
  private readonly listeners = new Set<() => void>()

  on(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(): void {
    for (const listener of [...this.listeners]) listener()
  }

  clear(): void {
    this.listeners.clear()
  }
}
