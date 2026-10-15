import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useVoiceRecorder } from '../../app/composables/useVoiceRecorder'
import { _resetAudioEngine } from '../../app/composables/useAudioEngine'

const decodedBuffer = { duration: 3, length: 3, sampleRate: 1, numberOfChannels: 1 } as unknown as AudioBuffer

function installMocks(opts: { getUserMedia?: () => Promise<any> } = {}) {
  return installMocksBase(opts)
}

function installMocksBase(opts: { getUserMedia?: () => Promise<any> } = {}) {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] }
  const getUserMedia = vi.fn(opts.getUserMedia ?? (async () => stream))
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })

  const recorders: any[] = []
  class MockMediaRecorder {
    state = 'inactive'
    ondataavailable: ((e: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    constructor(public stream: any) {
      recorders.push(this)
    }

    start = vi.fn(() => { this.state = 'recording' })
    stop = vi.fn(() => {
      this.state = 'inactive'
      this.ondataavailable?.({ data: new Blob(['abc']) })
      this.onstop?.()
    })
  }
  globalThis.MediaRecorder = MockMediaRecorder as any

  const decodeAudioData = vi.fn().mockResolvedValue(decodedBuffer)
  globalThis.AudioContext = vi.fn(function () {
    return { state: 'running', resume: vi.fn(), close: vi.fn().mockResolvedValue(undefined), decodeAudioData }
  }) as any

  return { getUserMedia, recorders, track, decodeAudioData }
}

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    _resetAudioEngine()
  })

  afterEach(() => {
    _resetAudioEngine()
    delete (globalThis as any).MediaRecorder
    delete (globalThis as any).AudioContext
    delete (globalThis.navigator as any).mediaDevices
    vi.restoreAllMocks()
  })

  it('reports unsupported when MediaRecorder is missing', () => {
    installMocks()
    delete (globalThis as any).MediaRecorder
    expect(useVoiceRecorder().isSupported()).toBe(false)
  })

  it('reports supported when getUserMedia and MediaRecorder exist', () => {
    installMocks()
    expect(useVoiceRecorder().isSupported()).toBe(true)
  })

  it('requests audio-only microphone access and begins recording', async () => {
    const { getUserMedia, recorders } = installMocks()
    const recorder = useVoiceRecorder()

    await recorder.start()

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(recorders[0].start).toHaveBeenCalled()
    expect(recorder.isRecording.value).toBe(true)
  })

  it('sets a permission error when microphone access is denied', async () => {
    installMocks({
      getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError') },
    })
    const recorder = useVoiceRecorder()

    await recorder.start()

    expect(recorder.isRecording.value).toBe(false)
    expect(recorder.error.value).toBe('permission-denied')
  })

  it('stop releases the microphone and resolves with the decoded buffer', async () => {
    const { track, decodeAudioData } = installMocks()
    const recorder = useVoiceRecorder()
    await recorder.start()

    const result = await recorder.stop()

    expect(result).toBe(decodedBuffer)
    expect(decodeAudioData).toHaveBeenCalledWith(expect.any(ArrayBuffer))
    expect(track.stop).toHaveBeenCalled()
    expect(recorder.isRecording.value).toBe(false)
  })

  it('cancel during a pending permission prompt releases the stream once it arrives', async () => {
    let resolveStream: ((s: any) => void) | null = null
    const { track } = installMocks({ getUserMedia: () => new Promise((r) => { resolveStream = r }) })
    const recorder = useVoiceRecorder()
    const starting = recorder.start()
    recorder.cancel()
    resolveStream!({ getTracks: () => [track] })
    await starting
    expect(track.stop).toHaveBeenCalled()
    expect(recorder.isRecording.value).toBe(false)
  })

  it('stop without start resolves null', async () => {
    installMocks()
    const result = await useVoiceRecorder().stop()
    expect(result).toBeNull()
  })
})
