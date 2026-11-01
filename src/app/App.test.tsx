import { act, render as rtlRender, screen } from '@testing-library/react'
import { StrictMode, type ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { asMediaStream, domError, FakeStream, FakeTrack } from '../test/fakeMedia'
import { App } from './App'

function mockDisplayMedia(impl: () => Promise<MediaStream>) {
  const getDisplayMedia = vi.fn<() => Promise<MediaStream>>(impl)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getDisplayMedia },
  })
  return getDisplayMedia
}

// Same as main.tsx: effects and ref callbacks run twice in development.
const render = (ui: ReactElement) => rtlRender(<StrictMode>{ui}</StrictMode>)

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

describe('App capture flow', () => {
  it('shows a recoverable message when the user cancels the picker', async () => {
    const user = userEvent.setup()
    const gdm = mockDisplayMedia(() => Promise.reject(domError('NotAllowedError')))
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))

    expect(gdm).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/seleção foi cancelada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' })).toBeEnabled()
  })

  it('explains when capture is unavailable (insecure origin / old browser)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    expect(await screen.findByText(/não permite captura/)).toBeInTheDocument()
  })

  it('disables the buttons while the picker is open', async () => {
    const user = userEvent.setup()
    mockDisplayMedia(() => new Promise<MediaStream>(() => {}))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    expect(screen.getByText(/Aguardando você escolher/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' })).toBeDisabled()
  })

  it('opens calibration, then "Parar captura" releases the tracks', async () => {
    const user = userEvent.setup()
    const stream = new FakeStream([new FakeTrack('video', 'Meet - sala')])
    mockDisplayMedia(() => Promise.resolve(asMediaStream(stream)))
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    expect(await screen.findByRole('heading', { name: 'Calibração' })).toBeInTheDocument()
    expect(screen.getByTestId('source-label')).toHaveTextContent('Meet - sala')

    await user.click(screen.getByRole('button', { name: 'Parar captura' }))
    expect(stream.allStopped).toBe(true)
    expect(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' })).toBeInTheDocument()
  })

  it('returns to setup with an explanation when the browser ends the share', async () => {
    const user = userEvent.setup()
    const track = new FakeTrack()
    mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream([track]))))
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    await screen.findByRole('heading', { name: 'Calibração' })

    act(() => track.endFromBrowser())
    expect(screen.getByText(/compartilhamento foi encerrado/)).toBeInTheDocument()
  })

  it('unmounting the app stops an active capture', async () => {
    const user = userEvent.setup()
    const stream = new FakeStream()
    mockDisplayMedia(() => Promise.resolve(asMediaStream(stream)))
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    await screen.findByRole('heading', { name: 'Calibração' })
    unmount()
    expect(stream.allStopped).toBe(true)
  })

  it('rejects a non-video local file with a clear message', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)
    await user.upload(
      screen.getByLabelText('Carregar vídeo local de teste'),
      new File(['x'], 'notas.txt', { type: 'text/plain' }),
    )
    expect(await screen.findByText(/não parece ser um vídeo/)).toBeInTheDocument()
  })
})
