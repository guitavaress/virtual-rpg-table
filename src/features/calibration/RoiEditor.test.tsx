import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoiEditor } from './RoiEditor'
import type { NormRect } from './roi'

const display = { x: 0, y: 50, width: 800, height: 450 }
const roi = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }

describe('RoiEditor keyboard control', () => {
  it('arrows move the region', () => {
    const onChange = vi.fn<(next: NormRect) => void>()
    render(<RoiEditor display={display} roi={roi} onChange={onChange} />)
    fireEvent.keyDown(screen.getByTestId('roi-box'), { key: 'ArrowRight' })
    const next = onChange.mock.lastCall?.[0]
    expect(next?.x).toBeCloseTo(0.11, 9)
    expect(next?.width).toBeCloseTo(0.5, 9)
  })

  it('Shift + arrows resize from the bottom-right corner', () => {
    const onChange = vi.fn<(next: NormRect) => void>()
    render(<RoiEditor display={display} roi={roi} onChange={onChange} />)
    fireEvent.keyDown(screen.getByTestId('roi-box'), { key: 'ArrowDown', shiftKey: true })
    const next = onChange.mock.lastCall?.[0]
    expect(next?.y).toBeCloseTo(0.1, 9)
    expect(next?.height).toBeCloseTo(0.51, 9)
  })

  it('renders nothing until the video has a size', () => {
    const { container } = render(
      <RoiEditor
        display={{ x: 0, y: 0, width: 0, height: 0 }}
        roi={roi}
        onChange={vi.fn<(next: NormRect) => void>()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RoiEditor pointer control', () => {
  it('dragging the body moves the region by the pointer delta', () => {
    const onChange = vi.fn<(next: NormRect) => void>()
    render(<RoiEditor display={display} roi={roi} onChange={onChange} />)
    const box = screen.getByTestId('roi-box')
    fireEvent.pointerDown(box, { pointerId: 1, button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 180, clientY: 145 })
    const next = onChange.mock.lastCall?.[0]
    expect(next?.x).toBeCloseTo(0.1 + 80 / 800, 9)
    expect(next?.y).toBeCloseTo(0.1 + 45 / 450, 9)
    expect(next?.width).toBeCloseTo(0.5, 9)
  })

  it('dragging the south-east handle resizes from the drag start, not cumulatively', () => {
    const onChange = vi.fn<(next: NormRect) => void>()
    const { container } = render(<RoiEditor display={display} roi={roi} onChange={onChange} />)
    const handle = container.querySelector('[data-handle="se"]')
    if (!handle) throw new Error('handle not rendered')
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 40, clientY: 0 })
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 80, clientY: 45 })
    const next = onChange.mock.lastCall?.[0]
    expect(next?.x).toBeCloseTo(0.1, 9)
    expect(next?.width).toBeCloseTo(0.5 + 80 / 800, 9)
    expect(next?.height).toBeCloseTo(0.5 + 45 / 450, 9)
  })

  it('ignores moves after pointer up and from other pointers', () => {
    const onChange = vi.fn<(next: NormRect) => void>()
    render(<RoiEditor display={display} roi={roi} onChange={onChange} />)
    const box = screen.getByTestId('roi-box')
    fireEvent.pointerDown(box, { pointerId: 1, button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(box, { pointerId: 9, clientX: 50, clientY: 50 })
    fireEvent.pointerUp(box, { pointerId: 1 })
    fireEvent.pointerMove(box, { pointerId: 1, clientX: 50, clientY: 50 })
    expect(onChange).not.toHaveBeenCalled()
  })
})
