import { describe, it, expect, vi, afterEach } from 'vitest'
import { useCameraSampler } from '../../app/composables/useCameraSampler'
import type { Sample } from '../../app/utils/ppg'

function fakeEnv(opts: { deny?: boolean; pixel?: [number, number, number]; deferStream?: boolean } = {}) {
  const listeners: Record<string, () => void> = {}
  const track = { stop: vi.fn(), addEventListener: vi.fn((ev: string, cb: () => void) => { listeners[ev] = cb }) }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  let resolveStream: ((s: MediaStream) => void) | null = null
  const getUserMedia = vi.fn(() => {
    if (opts.deny) return Promise.reject(new DOMException('denied', 'NotAllowedError'))
    if (opts.deferStream) return new Promise<MediaStream>((resolve) => { resolveStream = resolve })
    return Promise.resolve(stream as unknown as MediaStream)
  })
  const deliverStream = () => resolveStream?.(stream as unknown as MediaStream)
  const video = { readyState: 4, play: vi.fn().mockResolvedValue(undefined), srcObject: null as any, muted: false, playsInline: false }
  const [pr, pg, pb] = opts.pixel ?? [200, 100, 50]
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn((x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4)
      for (let i = 0; i < data.length; i += 4) { data[i] = pr; data[i + 1] = pg; data[i + 2] = pb; data[i + 3] = 255 }
      return { data, width: w, height: h }
    }),
  }
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) }
  const frames: FrameRequestCallback[] = []
  const raf = vi.fn((cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
  const caf = vi.fn()
  let t = 1000
  const now = () => t
  const samples: Sample[] = []
  const sampler = useCameraSampler({
    onSample: (s) => samples.push(s),
    getUserMedia,
    createVideo: () => video as unknown as HTMLVideoElement,
    createCanvas: () => canvas as unknown as HTMLCanvasElement,
    raf, caf, now,
  })
  const nextFrame = (advanceMs = 33) => { t += advanceMs; const cb = frames.shift(); cb?.(t) }
  return { sampler, samples, getUserMedia, track, listeners, ctx, video, frames, nextFrame, caf, deliverStream }
}

describe('useCameraSampler', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests a small front-facing video stream with no audio', async () => {
    const { sampler, getUserMedia } = fakeEnv()
    await sampler.start()
    expect(getUserMedia).toHaveBeenCalledWith({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false })
    expect(sampler.running.value).toBe(true)
  })

  it('emits the mean RGB of the central region each frame with a timestamp', async () => {
    const { sampler, samples, ctx, nextFrame } = fakeEnv({ pixel: [200, 100, 50] })
    await sampler.start()
    nextFrame(33)
    nextFrame(33)
    expect(samples).toHaveLength(2)
    expect(samples[0]).toEqual({ t: 1033, r: 200, g: 100, b: 50 })
    expect(samples[1]!.t).toBe(1066)
    // ROI is the central 40 % box of a 320×240 frame
    expect(ctx.getImageData).toHaveBeenCalledWith(96, 72, 128, 96)
  })

  it('maps a denied permission to permission-denied', async () => {
    const { sampler } = fakeEnv({ deny: true })
    await sampler.start()
    expect(sampler.error.value).toBe('permission-denied')
    expect(sampler.running.value).toBe(false)
  })

  it('stop cancels the frame loop and releases the camera', async () => {
    const { sampler, track, caf, video } = fakeEnv()
    await sampler.start()
    sampler.stop()
    expect(caf).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(video.srcObject).toBeNull()
    expect(sampler.running.value).toBe(false)
  })

  it('reports failed and stops when the track ends', async () => {
    const { sampler, listeners, track } = fakeEnv()
    await sampler.start()
    listeners.ended!()
    expect(sampler.error.value).toBe('failed')
    expect(sampler.running.value).toBe(false)
    expect(track.stop).toHaveBeenCalled()
  })

  it('stop during a pending permission prompt releases the stream once it arrives', async () => {
    const { sampler, track, video, frames, deliverStream } = fakeEnv({ deferStream: true })
    const starting = sampler.start()
    sampler.stop()
    deliverStream()
    await starting
    expect(track.stop).toHaveBeenCalled()
    expect(video.play).not.toHaveBeenCalled()
    expect(sampler.running.value).toBe(false)
    expect(frames).toHaveLength(0)
  })

  it('reports unsupported when getUserMedia is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: undefined, configurable: true })
    const sampler = useCameraSampler({ onSample: () => {} })
    await sampler.start()
    expect(sampler.error.value).toBe('unsupported')
  })
})
