/**
 * Frames-per-second over a sliding time window.
 * `tick(now)` once per presented frame; `fps(now)` reads the estimate.
 */
export class FpsMeter {
  private readonly stamps: number[] = []
  private readonly windowMs: number

  constructor(windowMs = 1000) {
    this.windowMs = windowMs
  }

  tick(now: number): void {
    this.stamps.push(now)
    this.prune(now)
  }

  fps(now: number): number {
    this.prune(now)
    const first = this.stamps[0]
    const last = this.stamps[this.stamps.length - 1]
    if (this.stamps.length < 2 || first === undefined || last === undefined || last === first) {
      return 0
    }
    return ((this.stamps.length - 1) * 1000) / (last - first)
  }

  reset(): void {
    this.stamps.length = 0
  }

  private prune(now: number): void {
    while (this.stamps.length > 0 && (this.stamps[0] ?? now) < now - this.windowMs) {
      this.stamps.shift()
    }
  }
}
