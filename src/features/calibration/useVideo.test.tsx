import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { asMediaStream, FakeStream } from '../../test/fakeMedia'
import type { AttachedMedia } from '../capture/types'
import { useAttachedVideo } from './useVideo'

function Probe({ media }: { media: AttachedMedia }) {
  const [, ref] = useAttachedVideo(media)
  return <video data-testid="v" ref={ref} />
}

const streamMedia = (): AttachedMedia => ({
  kind: 'stream',
  stream: asMediaStream(new FakeStream()),
})

describe('useAttachedVideo (StrictMode)', () => {
  it('attaches, swaps and detaches the media on the same element', () => {
    const a = streamMedia()
    const b: AttachedMedia = { kind: 'url', url: 'blob:fake-b' }
    const { getByTestId, rerender, unmount } = render(
      <StrictMode>
        <Probe media={a} />
      </StrictMode>,
    )
    const video = getByTestId('v') as HTMLVideoElement
    expect(video.srcObject).toBe(a.kind === 'stream' ? a.stream : null)
    expect(video.muted).toBe(true)

    rerender(
      <StrictMode>
        <Probe media={b} />
      </StrictMode>,
    )
    expect(video.srcObject).toBeNull()
    expect(video.getAttribute('src')).toBe('blob:fake-b')

    unmount()
    expect(video.srcObject).toBeNull()
    expect(video.hasAttribute('src')).toBe(false)
  })
})
