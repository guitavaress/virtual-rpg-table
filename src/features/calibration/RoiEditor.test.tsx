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
