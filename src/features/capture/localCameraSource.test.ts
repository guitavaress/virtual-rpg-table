import { describe, expect, it } from 'vitest'
import {
  asMediaStream,
  controllableCameraProvider,
  domError,
  FakeStream,
  FakeTrack,
} from '../../test/fakeMedia'
import { CaptureSession } from './captureSession'
import { cameraConstraints, LocalCameraSource } from './localCameraSource'
import { CAMERA_BUSY_MESSAGE, describeCaptureError } from '../../components/CaptureSetup/messages'

function setup(options = {}) {
  const session = new CaptureSession()
  const fake = controllableCameraProvider()
  const newSource = (o = options) => new LocalCameraSource(o, fake.provider)
  return { session, fake, newSource }
}

describe('LocalCameraSource', () => {
  it('goes requesting → active, calling getUserMedia synchronously with the chosen device', async () => {
    const { session, fake, newSource } = setup({ deviceId: 'cam-2', quality: '1080p' })
    const done = session.start(newSource())
    expect(session.getState().status).toBe('requesting')
    // Synchronous: still inside the click handler's user activation.
    expect(fake.calls).toHaveLength(1)

    fake.calls[0]?.resolve(asMediaStream(new FakeStream([new FakeTrack('video', 'Logitech C920')])))
    await done

    expect(session.getState()).toMatchObject({
      status: 'active',
      kind: 'camera',
      label: 'Logitech C920',
    })
    expect(fake.constraints[0]).toEqual({
      video: {
        deviceId: { exact: 'cam-2' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    })
  })

  it('720p lowers the ideal size and the default camera sends no deviceId', () => {
    expect(cameraConstraints({ quality: '720p' })).toEqual({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: false,
    })
  })

  it('never asks for audio and drops audio tracks a browser returns anyway', async () => {
    const { session, fake, newSource } = setup()
    const audio = new FakeTrack('audio')
    const stream = new FakeStream([new FakeTrack('video'), audio])
    const done = session.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(stream))
    await done
    expect(fake.constraints[0]?.audio).toBe(false)
    expect(audio.stopCalls).toBe(1)
    expect(stream.getAudioTracks()).toHaveLength(0)
  })

  it.each([
    ['NotAllowedError', 'denied-or-cancelled'],
    ['NotReadableError', 'source-busy'],
    ['OverconstrainedError', 'overconstrained'],
    ['NotFoundError', 'source-unavailable'],
  ])('%s → %s', async (name, code) => {
    const { session, fake, newSource } = setup()
    const done = session.start(newSource())
    fake.calls[0]?.reject(domError(name))
    await done
    expect(session.getState()).toMatchObject({ status: 'error', kind: 'camera', error: { code } })
  })

  it('NotReadableError explains the Windows webcam sharing limit and the same-browser fix', async () => {
    const { session, fake, newSource } = setup()
    const done = session.start(newSource())
    fake.calls[0]?.reject(domError('NotReadableError'))
    await done
    const state = session.getState()
    if (state.status !== 'error') throw new Error('expected error')
    const message = describeCaptureError('camera', state.error)
    expect(message).toBe(CAMERA_BUSY_MESSAGE)
    expect(message).toMatch(/Windows/)
    expect(message).toMatch(/não compartilham/)
    expect(message).toMatch(/MESMO navegador/)
    expect(message).toMatch(/Meet/)
  })

  it('reports unsupported when mediaDevices is missing (insecure origin)', async () => {
    const session = new CaptureSession()
    await session.start(new LocalCameraSource({}, undefined))
    expect(session.getState()).toMatchObject({ status: 'error', error: { code: 'unsupported' } })
  })

  it('stop() releases every track and returns to idle', async () => {
    const { session, fake, newSource } = setup()
    const stream = new FakeStream([new FakeTrack()])
    const done = session.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(stream))
    await done
    session.stop()
    expect(session.getState().status).toBe('idle')
    expect(stream.allStopped).toBe(true)
  })

  it('moves to ended when the camera is unplugged or taken, releasing the track', async () => {
    const { session, fake, newSource } = setup()
    const track = new FakeTrack()
    const done = session.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(new FakeStream([track])))
    await done
    track.endFromBrowser()
    expect(session.getState()).toMatchObject({ status: 'ended', kind: 'camera' })
    expect(track.stopCalls).toBeGreaterThan(0)
  })

  it('race: stop() while the permission prompt is open releases the late stream', async () => {
    const { session, fake, newSource } = setup()
    const done = session.start(newSource())
    session.stop()
    const late = new FakeStream()
    fake.calls[0]?.resolve(asMediaStream(late))
    await done
    expect(late.allStopped).toBe(true)
    expect(session.getState().status).toBe('idle')
  })

  it('a stream whose track already ended is released and reported as an error', async () => {
    const { session, fake, newSource } = setup()
    const track = new FakeTrack()
    track.readyState = 'ended'
    const done = session.start(newSource())
    fake.calls[0]?.resolve(asMediaStream(new FakeStream([track])))
    await done
    expect(session.getState()).toMatchObject({ status: 'error' })
    expect(track.stopCalls).toBeGreaterThan(0)
  })
})
