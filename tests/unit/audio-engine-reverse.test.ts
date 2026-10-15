import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useAudioEngine,
  reverseAudioBuffer,
  playbackRateToFit,
  _resetAudioEngine,
} from '../../app/composables/useAudioEngine'

/** Build a mock AudioBuffer backed by real Float32Arrays so reversal can be verified. */
function createPcmBuffer(channels: Float32Array[], sampleRate = 44100) {
  return {
    numberOfChannels: channels.length,
    length: channels[0]!.length,
    sampleRate,
    duration: channels[0]!.length / sampleRate,
    getChannelData: (i: number) => channels[i]!,
  } as unknown as AudioBuffer
}

function setupMockAudioContext() {
  const sources: any[] = []
  const gains: any[] = []
  const mockCtx = {
    state: 'running',
    currentTime: 10,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    destination: { kind: 'destination' },
    createBuffer: vi.fn((numberOfChannels: number, length: number, sampleRate: number) => {
      const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
      return createPcmBuffer(channels, sampleRate)
    }),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as AudioBuffer | null,
        playbackRate: { value: 1 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }
      sources.push(source)
      return source
    }),
    createGain: vi.fn(() => {
      const gain = { gain: { value: 1 }, connect: vi.fn() }
      gains.push(gain)
      return gain
    }),
  }
  globalThis.AudioContext = vi.fn(function () { return mockCtx }) as any
  return { mockCtx, sources, gains }
}

describe('reverseAudioBuffer', () => {
  afterEach(() => {
    _resetAudioEngine()
    delete (globalThis as any).AudioContext
  })

  it('reverses every channel sample-by-sample into a new buffer', () => {
    const { mockCtx } = setupMockAudioContext()
    const left = new Float32Array([0.1, 0.2, 0.3, 0.4])
    const right = new Float32Array([1, 2, 3, 4])
    const input = createPcmBuffer([left, right], 8000)

    const output = reverseAudioBuffer(input, mockCtx as unknown as AudioContext)

    expect(mockCtx.createBuffer).toHaveBeenCalledWith(2, 4, 8000)
    expect(Array.from(output.getChannelData(0))).toEqual([0.4, 0.3, 0.2, 0.1].map(Math.fround))
    expect(Array.from(output.getChannelData(1))).toEqual([4, 3, 2, 1])
    // Input is untouched
    expect(Array.from(left)).toEqual([0.1, 0.2, 0.3, 0.4].map(Math.fround))
  })
})

describe('playbackRateToFit', () => {
  it('speeds up a long recording so it fits the target window', () => {
    expect(playbackRateToFit(15, 1500)).toBe(10)
  })

  it('never slows playback below real time for short recordings', () => {
    expect(playbackRateToFit(0.5, 1500)).toBe(1)
  })
})

describe('useAudioEngine.playBuffer', () => {
  afterEach(() => {
    _resetAudioEngine()
    delete (globalThis as any).AudioContext
  })

  it('plays the buffer through a gain node at the given rate and start time', async () => {
    const { mockCtx, sources, gains } = setupMockAudioContext()
    const buffer = createPcmBuffer([new Float32Array(10)])
    const engine = useAudioEngine()

    const source = await engine.playBuffer(buffer, { startTime: 12.5, playbackRate: 8, gain: 0.6 })

    expect(source).toBe(sources[0])
    expect(sources[0].buffer).toBe(buffer)
    expect(sources[0].playbackRate.value).toBe(8)
    expect(gains[0].gain.value).toBe(0.6)
    expect(sources[0].connect).toHaveBeenCalledWith(gains[0])
    expect(gains[0].connect).toHaveBeenCalledWith(mockCtx.destination)
    expect(sources[0].start).toHaveBeenCalledWith(12.5)
  })

  it('defaults to rate 1, full gain, and immediate start', async () => {
    const { sources, gains } = setupMockAudioContext()
    const buffer = createPcmBuffer([new Float32Array(10)])
    const engine = useAudioEngine()

    await engine.playBuffer(buffer)

    expect(sources[0].playbackRate.value).toBe(1)
    expect(gains[0].gain.value).toBe(1)
    expect(sources[0].start).toHaveBeenCalledWith(0)
  })

  it('returns null when Web Audio is unavailable', async () => {
    globalThis.AudioContext = vi.fn(function () { throw new Error('not supported') }) as any
    const buffer = createPcmBuffer([new Float32Array(10)])
    const engine = useAudioEngine()

    const result = await engine.playBuffer(buffer)

    expect(result).toBeNull()
  })
})
