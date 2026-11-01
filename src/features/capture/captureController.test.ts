import { describe, expect, it, vi } from 'vitest'
import {
  asMediaStream,
  controllableProvider,
  domError,
  FakeStream,
  FakeTrack,
} from '../../test/fakeMedia'
import { CaptureController } from './captureController'
import { CapturedDisplaySource, DISPLAY_MEDIA_OPTIONS } from './displaySource'

function setup() {
  const controller = new CaptureController()
  const fake = controllableProvider()
  const newSource = () => new CapturedDisplaySource(fake.provider)
  return { controller, fake, newSource }
}

describe('CaptureController with display sources', () => {
  it('goes requesting → active and asks for video only', async () => {
    const { controller, fake, newSource } = setup()
    const states: string[] = []
    controller.subscribe((s) => states.push(s.status))

    const done = controller.start(newSource())
    expect(controller.getState().status).toBe('requesting')
    // getDisplayMedia must be called synchronously (user-activation requirement).
    expect(fake.calls).toHaveLength(1)

    const stream = new FakeStream([new FakeTrack('video', 'Meet - sala')])
    fake.calls[0]?.resolve(asMediaStream(stream))
    await done

    const state = controller.getState()
    expect(states).toEqual(['requesting', 'active'])
    expect(state).toMatchObject({ status: 'active', label: 'Meet - sala' })
    expect(fake.options[0]).toEqual(DISPLAY_MEDIA_OPTIONS)
    expect(fake.options[0]?.audio).toBe(false)
    expect(DISPLAY_MEDIA_OPTIONS.selfBrowserSurface).toBe('exclude')
  })

  it('maps a cancelled picker to denied-or-cancelled', async () => {
    const { controller, fake, newSource } = setup()
    const done = controller.start(newSource())
    fake.calls[0]?.reject(domError('NotAllowedError', 'Permission denied'))
    await done
    expect(controller.getState()).toMatchObject({
      status: 'error',
      error: { code: 'denied-or-cancelled' },
    })
  })

  it('reports unsupported when the API is missing', async () => {
    const controller = new CaptureController()
    await controller.start(new CapturedDisplaySource(undefined))
    expect(controller.getState()).toMatchObject({ status: 'error', error: { code: 'unsupported' } })
  })

  it('moves to ended when the browser stops sharing, and ignores later events', async () => {
    const { controller, fake, newSource } = setup()
    const track = new FakeTrack()
    const done = controller.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(new FakeStream([track])))
    await done

    const listener = vi.fn<() => void>()
    controller.subscribe(listener)
    track.endFromBrowser()
    expect(controller.getState().status).toBe('ended')
    expect(track.stopCalls).toBeGreaterThan(0)

    track.endFromBrowser()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stop() releases every track and returns to idle', async () => {
    const { controller, fake, newSource } = setup()
    const stream = new FakeStream([new FakeTrack(), new FakeTrack()])
    const done = controller.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(stream))
    await done

    controller.stop()
    expect(controller.getState().status).toBe('idle')
    expect(stream.allStopped).toBe(true)
  })

  it('switching source stops the old tracks before asking for the new one', async () => {
    const { controller, fake, newSource } = setup()
    const first = new FakeStream()
    const p1 = controller.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(first))
    await p1

    const p2 = controller.start(newSource())
    expect(first.allStopped).toBe(true)
    expect(fake.calls).toHaveLength(2)

    const second = new FakeStream()
    fake.calls[1]?.resolve(asMediaStream(second))
    await p2
    expect(controller.getState().status).toBe('active')
    expect(second.allStopped).toBe(false)
  })

  it('race: stop() while the picker is open releases the late stream', async () => {
    const { controller, fake, newSource } = setup()
    const done = controller.start(newSource())
    controller.stop()
    expect(controller.getState().status).toBe('idle')

    const late = new FakeStream()
    fake.calls[0]?.resolve(asMediaStream(late))
    await done
    expect(late.allStopped).toBe(true)
    expect(controller.getState().status).toBe('idle')
  })

  it('race: an older request resolving after a newer one is released', async () => {
    const { controller, fake, newSource } = setup()
    const p1 = controller.start(newSource())
    const p2 = controller.start(newSource())

    const newer = new FakeStream()
    fake.calls[1]?.resolve(asMediaStream(newer))
    await p2

    const older = new FakeStream()
    fake.calls[0]?.resolve(asMediaStream(older))
    await p1

    expect(older.allStopped).toBe(true)
    expect(newer.allStopped).toBe(false)
    expect(controller.getState().status).toBe('active')
  })

  it('race: a stale request failing does not overwrite the current state', async () => {
    const { controller, fake, newSource } = setup()
    const done = controller.start(newSource())
    controller.stop()
    fake.calls[0]?.reject(domError('NotAllowedError'))
    await done
    expect(controller.getState().status).toBe('idle')
  })

  it('drops audio tracks a browser might return despite audio:false', async () => {
    const { controller, fake, newSource } = setup()
    const audio = new FakeTrack('audio')
    const stream = new FakeStream([new FakeTrack('video'), audio])
    const done = controller.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(stream))
    await done
    expect(audio.stopCalls).toBe(1)
    expect(stream.getAudioTracks()).toHaveLength(0)
  })
})
