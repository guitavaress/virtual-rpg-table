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

describe('App table flow (F1)', () => {
  const startDisplay = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
  }

  it('calibrates players, opens the table and persists the setup', async () => {
    const user = userEvent.setup()
    mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream())))
    render(<App />)
    await startDisplay(user)
    await screen.findByRole('heading', { name: 'Calibração' })

    await user.click(screen.getByRole('button', { name: 'Próximo: jogadores' }))
    const name1 = screen.getByLabelText('Nome 1')
    await user.clear(name1)
    await user.type(name1, 'Ana')
    await user.type(screen.getByLabelText('Personagem 1'), 'Elfa')
    await user.click(screen.getByRole('button', { name: 'Ir para a mesa' }))

    expect(await screen.findByRole('heading', { name: 'Mesa' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getByRole('article', { name: 'Ana, Elfa' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Você' })).toHaveTextContent('Remoto')

    const saved = JSON.parse(localStorage.getItem('virtual-rpg-table/config/v1') ?? 'null')
    expect(saved?.players?.[0]?.name).toBe('Ana')
  })

  it('remote avatar mode renders no video canvas; crop mode does', async () => {
    const user = userEvent.setup()
    mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream())))
    render(<App />)
    await startDisplay(user)
    await user.click(await screen.findByRole('button', { name: 'Próximo: jogadores' }))
    await user.click(screen.getByRole('button', { name: 'Ir para a mesa' }))
    const remote = await screen.findByRole('article', { name: 'Você' })
    expect(remote.querySelector('canvas')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Calibrar' }))
    await user.click(screen.getByLabelText('Recorte da captura'))
    await user.click(screen.getByRole('button', { name: 'Ir para a mesa' }))
    expect(
      (await screen.findByRole('article', { name: 'Você' })).querySelector('canvas'),
    ).not.toBeNull()
  })

  it('with a saved setup, the next capture opens straight on the table', async () => {
    const user = userEvent.setup()
    const { defaultConfig } = await import('../features/table/model')
    const { saveTableConfig } = await import('../features/table/storage')
    saveTableConfig(defaultConfig())
    mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream())))
    render(<App />)
    expect(screen.getByText(/está salva neste navegador/)).toBeInTheDocument()
    await startDisplay(user)
    expect(await screen.findByRole('heading', { name: 'Mesa' })).toBeInTheDocument()
  })

  it('keeps the table when the share drops and reconnects in place', async () => {
    const user = userEvent.setup()
    const first = new FakeTrack()
    const second = new FakeStream()
    const gdm = mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream([first]))))
    render(<App />)
    await startDisplay(user)
    await user.click(await screen.findByRole('button', { name: 'Próximo: jogadores' }))
    await user.click(screen.getByRole('button', { name: 'Ir para a mesa' }))
    await screen.findByRole('heading', { name: 'Mesa' })

    act(() => first.endFromBrowser())
    expect(screen.getByRole('heading', { name: 'Mesa' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/compartilhamento foi encerrado/)
    expect(screen.getAllByText('Fonte perdida')).toHaveLength(5)

    gdm.mockImplementation(() => Promise.resolve(asMediaStream(second)))
    await user.click(screen.getByRole('button', { name: 'Reconectar' }))
    await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.queryByText('Fonte perdida')).toBeNull()
    expect(gdm).toHaveBeenCalledTimes(2)
  })

  it('cancelling the picker on reconnect keeps the table with a message', async () => {
    const user = userEvent.setup()
    const track = new FakeTrack()
    const gdm = mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream([track]))))
    render(<App />)
    await startDisplay(user)
    await user.click(await screen.findByRole('button', { name: 'Próximo: jogadores' }))
    await user.click(screen.getByRole('button', { name: 'Ir para a mesa' }))
    act(() => track.endFromBrowser())

    gdm.mockImplementation(() => Promise.reject(domError('NotAllowedError')))
    await user.click(screen.getByRole('button', { name: 'Reconectar' }))
    expect(await screen.findByText(/seleção foi cancelada/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mesa' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' })).toBeInTheDocument()
  })

  it('"Apagar configuração salva" clears storage', async () => {
    const user = userEvent.setup()
    const { defaultConfig } = await import('../features/table/model')
    const { saveTableConfig } = await import('../features/table/storage')
    saveTableConfig(defaultConfig())
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Apagar configuração salva' }))
    expect(localStorage.getItem('virtual-rpg-table/config/v1')).toBeNull()
    expect(screen.queryByText(/está salva neste navegador/)).toBeNull()
  })
})

describe('App persistence and reconnect rules (F1 review)', () => {
  it('saves nothing while calibrating; saves from the first "Ir para a mesa"', async () => {
    const user = userEvent.setup()
    mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream())))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    await user.click(await screen.findByRole('button', { name: 'Próximo: jogadores' }))
    await user.type(screen.getByLabelText('Personagem 1'), 'Bardo')
    expect(localStorage.getItem('virtual-rpg-table/config/v1')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Ir para a mesa' }))
    const saved = JSON.parse(localStorage.getItem('virtual-rpg-table/config/v1') ?? 'null')
    expect(saved?.players?.[0]?.character).toBe('Bardo')
  })

  it('a fresh start from setup is not treated as a table reconnect', async () => {
    const user = userEvent.setup()
    const track = new FakeTrack()
    const gdm = mockDisplayMedia(() => Promise.resolve(asMediaStream(new FakeStream([track]))))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    await user.click(await screen.findByRole('button', { name: 'Próximo: jogadores' }))
    await user.click(screen.getByRole('button', { name: 'Ir para a mesa' }))
    act(() => track.endFromBrowser())

    gdm.mockImplementation(() => Promise.reject(domError('NotAllowedError')))
    await user.click(screen.getByRole('button', { name: 'Reconectar' }))
    await screen.findByText(/seleção foi cancelada/)
    await user.click(screen.getByRole('button', { name: 'Voltar ao início' }))

    // Cancelling from the setup screen must leave us on the setup screen.
    await user.click(screen.getByRole('button', { name: 'Selecionar fonte de vídeo' }))
    expect(await screen.findByText(/seleção foi cancelada/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mesa' })).toBeNull()
  })

  it('warns on the table when the local video cannot be played', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { defaultConfig } = await import('../features/table/model')
    const { saveTableConfig } = await import('../features/table/storage')
    saveTableConfig(defaultConfig())
    const createObjectURL = vi.fn<(b: Blob) => string>(() => 'blob:broken')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn<(u: string) => void>() })
    const { container } = render(<App />)
    await user.upload(
      screen.getByLabelText('Carregar vídeo local de teste'),
      new File(['junk'], 'x.mp4', { type: 'video/mp4' }),
    )
    await screen.findByRole('heading', { name: 'Mesa' })
    const video = container.querySelector('video')
    act(() => {
      video?.dispatchEvent(new Event('error'))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/não conseguiu reproduzir este vídeo/)
  })
})

describe('App camera source (F1.5 W0)', () => {
  /** A camera whose labels only appear after the first getUserMedia, like a real browser. */
  function mockCamera(impl: (c?: MediaStreamConstraints) => Promise<MediaStream>) {
    let granted = false
    const getUserMedia = vi.fn<(c?: MediaStreamConstraints) => Promise<MediaStream>>(async (c) => {
      const stream = await impl(c)
      granted = true
      return stream
    })
    const enumerateDevices = vi.fn<() => Promise<MediaDeviceInfo[]>>(() =>
      Promise.resolve([
        { kind: 'videoinput', deviceId: 'cam-a', label: granted ? 'Webcam A' : '' },
        { kind: 'videoinput', deviceId: 'cam-b', label: granted ? 'Webcam B' : '' },
      ] as MediaDeviceInfo[]),
    )
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices },
    })
    return { getUserMedia, enumerateDevices }
  }

  const liveStream = () => {
    const track = new FakeTrack('video', 'Webcam B')
    track.settings = { width: 1280, height: 720, frameRate: 30 }
    return { track, stream: new FakeStream([track]) }
  }

  it('first click asks permission and lists cameras; second click opens the chosen one', async () => {
    const user = userEvent.setup()
    const { stream, track } = liveStream()
    const probe = new FakeTrack('video')
    const m = mockCamera((c) =>
      Promise.resolve(asMediaStream(c?.video === true ? new FakeStream([probe]) : stream)),
    )
    render(<App />)

    expect(screen.queryByLabelText('Câmera')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Câmera deste computador' }))
    // The probe asks for video only and is released at once.
    expect(m.getUserMedia).toHaveBeenCalledWith({ video: true, audio: false })
    expect(probe.stopCalls).toBe(1)

    await user.selectOptions(await screen.findByLabelText('Câmera'), 'Webcam B')
    await user.selectOptions(screen.getByLabelText('Qualidade'), '720p')
    await user.click(screen.getByRole('button', { name: 'Usar câmera deste computador' }))

    expect(m.getUserMedia).toHaveBeenLastCalledWith({
      video: {
        deviceId: 'cam-b',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    })
    expect(await screen.findByRole('heading', { name: 'Calibração' })).toBeInTheDocument()
    expect(screen.getByTestId('source-label')).toHaveTextContent('Webcam B')
    expect(screen.getByTestId('track-resolution')).toHaveTextContent('1280×720 a 30 fps')

    await user.click(screen.getByRole('button', { name: 'Parar captura' }))
    expect(stream.allStopped).toBe(true)
    expect(track.stopCalls).toBeGreaterThan(0)
  })

  it('explains the Windows webcam limit when another program holds the camera', async () => {
    const user = userEvent.setup()
    mockCamera(() => Promise.reject(domError('NotReadableError')))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Câmera deste computador' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/programas diferentes não compartilham a webcam/)
    expect(alert).toHaveTextContent(/MESMO navegador/)
  })

  it('a denied permission keeps the setup usable with a clear message', async () => {
    const user = userEvent.setup()
    mockCamera(() => Promise.reject(domError('NotAllowedError')))
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Câmera deste computador' }))
    expect(await screen.findByText(/permissão da câmera foi negada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Câmera deste computador' })).toBeEnabled()
  })
})
