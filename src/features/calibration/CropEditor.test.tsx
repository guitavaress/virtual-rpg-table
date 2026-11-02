import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PortraitCrop } from '../compositor/portrait'
import { CropEditor, type CropBox } from './CropEditor'

// 1920×1080 video letterboxed in a 1000×1000 stage: drawn 1000×562.5 at y=218.75.
const display = { x: 0, y: 218.75, width: 1000, height: 562.5 }
const video = { width: 1920, height: 1080 }
const roi = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }

const box = (id: string, crop: PortraitCrop): CropBox => ({
  id,
  label: id,
  color: '#fff',
  crop,
  region: 'roi',
})

function setup(boxes: CropBox[]) {
  const onChange = vi.fn<(id: string, crop: PortraitCrop) => void>()
  const utils = render(
    <CropEditor display={display} video={video} roi={roi} boxes={boxes} onChange={onChange} />,
  )
  return { onChange, ...utils }
}

describe('CropEditor', () => {
  it('dragging the body moves the center by pointer delta / region size on screen', () => {
    const { onChange } = setup([box('p1', { cx: 0.5, cy: 0.5, size: 0.4 })])
    const el = screen.getByTestId('crop-p1')
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 80, clientY: 45 })
    const [id, crop] = onChange.mock.lastCall ?? []
    expect(id).toBe('p1')
    expect(crop?.cx).toBeCloseTo(0.5 + 80 / (1000 * 0.8), 9)
    expect(crop?.cy).toBeCloseTo(0.5 + 45 / (562.5 * 0.8), 9)
    expect(crop?.size).toBeCloseTo(0.4, 9)
  })

  it('dragging the zoom handle outwards grows the crop, inwards shrinks it', () => {
    const { onChange, container } = setup([box('p1', { cx: 0.5, cy: 0.5, size: 0.4 })])
    const handle = container.querySelector('[data-handle="zoom-p1"]')
    if (!handle) throw new Error('handle not rendered')
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 0, clientY: 45 })
    expect(onChange.mock.lastCall?.[1]?.size).toBeCloseTo(0.4 + 45 / (562.5 * 0.8), 9)
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 0, clientY: -45 })
    expect(onChange.mock.lastCall?.[1]?.size).toBeCloseTo(0.4 - 45 / (562.5 * 0.8), 9)
  })

  it('renders zoom handles in a layer above every frame (not inside a neighbour)', () => {
    const { container } = setup([
      box('p1', { cx: 0.3, cy: 0.5, size: 0.5 }),
      box('p2', { cx: 0.35, cy: 0.5, size: 0.5 }),
    ])
    const handle = container.querySelector('[data-handle="zoom-p1"]')
    const lastFrame = screen.getByTestId('crop-p2')
    expect(handle?.closest('[data-testid^="crop-"]')).toBeNull()
    // Later in the DOM and with its own z-index: painted above the frames.
    expect(
      lastFrame.compareDocumentPosition(handle as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(handle?.className).toContain('z-10')
  })

  it('keyboard moves from the clamped position (no dead zone after a stale crop)', () => {
    // cx=0 is outside the valid range for this size: the first ArrowRight must move it.
    const { onChange } = setup([box('p1', { cx: 0, cy: 0.5, size: 0.6 })])
    fireEvent.keyDown(screen.getByTestId('crop-p1'), { key: 'ArrowRight' })
    const halfW = (0.6 * 1080 * 0.8 * 0.75) / (1920 * 0.8) / 2
    expect(onChange.mock.lastCall?.[1]?.cx).toBeCloseTo(halfW + 0.01, 9)
  })

  it('exposes position and size to assistive tech', () => {
    setup([box('p1', { cx: 0.5, cy: 0.5, size: 0.4 })])
    expect(screen.getByTestId('crop-p1')).toHaveAccessibleName(
      /centro a 50% da esquerda e 50% do topo, altura de 40% da câmera coletiva/,
    )
  })
})
