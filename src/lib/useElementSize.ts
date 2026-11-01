import { useEffect, useState } from 'react'
import type { Size } from '../features/calibration/roi'

/** Tracks an element's content-box size (ResizeObserver, window resize fallback). */
export function useElementSize(element: HTMLElement | null): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    if (!element) return
    const measure = (): void => {
      const { width, height } = element.getBoundingClientRect()
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return size
}
