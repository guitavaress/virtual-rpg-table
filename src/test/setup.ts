import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no media pipeline: make <video> methods inert instead of "not implemented".
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: () => Promise.resolve(),
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: () => {} })
// jsdom has no canvas backend; components must cope with a null 2D context.
// jsdom lacks pointer capture.
Object.defineProperty(Element.prototype, 'setPointerCapture', {
  configurable: true,
  value: () => {},
})
Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  configurable: true,
  value: () => {},
})
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => null,
})

afterEach(() => {
  cleanup()
})
