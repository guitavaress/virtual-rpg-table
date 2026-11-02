import { describe, expect, it, vi } from 'vitest'
import { asMediaStream, FakeStream, FakeTrack } from '../../test/fakeMedia'
import { labeledCameras, requestCameraPermission } from './cameraDevices'

const info = (kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo =>
  ({ kind, deviceId, label, groupId: '', toJSON: () => ({}) }) as MediaDeviceInfo

describe('camera devices', () => {
  it('lists only labeled video inputs (labels are hidden before permission)', () => {
    const before = [info('videoinput', '', ''), info('audioinput', '', '')]
    expect(labeledCameras(before)).toEqual([])
    const after = [
      info('videoinput', 'a', 'Webcam A'),
      info('audioinput', 'm', 'Mic'),
      info('videoinput', 'b', 'Webcam B'),
    ]
    expect(labeledCameras(after)).toEqual([
      { deviceId: 'a', label: 'Webcam A' },
      { deviceId: 'b', label: 'Webcam B' },
    ])
  })

  it('the permission probe asks for video only and stops its tracks at once', async () => {
    const track = new FakeTrack()
    const getUserMedia = vi.fn<(c?: MediaStreamConstraints) => Promise<MediaStream>>(() =>
      Promise.resolve(asMediaStream(new FakeStream([track]))),
    )
    await requestCameraPermission({ getUserMedia, enumerateDevices: () => Promise.resolve([]) })
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: false })
    expect(track.stopCalls).toBe(1)
  })
})
