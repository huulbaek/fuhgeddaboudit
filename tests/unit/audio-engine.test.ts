import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAudioEngine, _resetAudioEngine } from '../../app/composables/useAudioEngine'

// Mock AudioBuffer
function createMockBuffer() {
  return { duration: 1, length: 44100, sampleRate: 44100, numberOfChannels: 2 } as unknown as AudioBuffer
}

// Mock AudioBufferSourceNode
function createMockSourceNode() {
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  }
}

// Mock OscillatorNode
function createMockOscillator() {
  return {
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  }
}

// Mock GainNode
function createMockGain() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
  }
}

// Mock ChannelMergerNode
function createMockMerger() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function setupMockAudioContext(state: 'running' | 'suspended' = 'running') {
  const mockBuffer = createMockBuffer()
  const mockCtx = {
    state,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    destination: {},
    decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
    createBufferSource: vi.fn(() => createMockSourceNode()),
    createOscillator: vi.fn(() => createMockOscillator()),
    createGain: vi.fn(() => createMockGain()),
    createChannelMerger: vi.fn(() => createMockMerger()),
  }

  // After resume(), change state to running
  mockCtx.resume.mockImplementation(async () => {
    Object.defineProperty(mockCtx, 'state', { value: 'running', writable: true, configurable: true })
  })

  // Replace global AudioContext — must happen BEFORE _resetAudioEngine or useAudioEngine
  // Use function keyword (not arrow) so it works as a constructor with `new`
  globalThis.AudioContext = vi.fn(function () { return mockCtx }) as any

  return { mockCtx, mockBuffer }
}

describe('useAudioEngine', () => {
  afterEach(() => {
    _resetAudioEngine()
    vi.restoreAllMocks()
    // Clean up our global stubs
    delete (globalThis as any).AudioContext
  })

  describe('preload', () => {
    it('fetches and decodes audio data', async () => {
      const { mockCtx, mockBuffer } = setupMockAudioContext()
      const mockArrayBuffer = new ArrayBuffer(8)
      globalThis.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      }) as any

      const engine = useAudioEngine()
      const result = await engine.preload('/audio/test.mp3')

      expect(fetch).toHaveBeenCalledWith('/audio/test.mp3')
      expect(mockCtx.decodeAudioData).toHaveBeenCalledWith(mockArrayBuffer)
      expect(result).toBe(mockBuffer)
    })

    it('returns cached buffer on subsequent calls', async () => {
      setupMockAudioContext()
      globalThis.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as any

      const engine = useAudioEngine()
      await engine.preload('/audio/test.mp3')
      const result = await engine.preload('/audio/test.mp3')

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result).toBeTruthy()
    })

    it('returns null when Web Audio is unavailable', async () => {
      globalThis.AudioContext = vi.fn(function () { throw new Error('not supported') }) as any

      const engine = useAudioEngine()
      const result = await engine.preload('/audio/test.mp3')
      expect(result).toBeNull()
    })
  })

  describe('playImmediate', () => {
    it('plays audio using Web Audio API', async () => {
      const { mockCtx } = setupMockAudioContext()
      globalThis.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as any

      const engine = useAudioEngine()
      await engine.playImmediate('/audio/test.mp3')

      expect(mockCtx.createBufferSource).toHaveBeenCalled()
    })

    it('resumes suspended context before playing', async () => {
      const { mockCtx } = setupMockAudioContext('suspended')
      globalThis.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as any

      const engine = useAudioEngine()
      await engine.playImmediate('/audio/test.mp3')

      expect(mockCtx.resume).toHaveBeenCalled()
      expect(mockCtx.createBufferSource).toHaveBeenCalled()
    })

    it('falls back to HTML5 Audio when Web Audio is unavailable', async () => {
      globalThis.AudioContext = vi.fn(function () { throw new Error('not supported') }) as any
      const mockPlay = vi.fn().mockResolvedValue(undefined)
      globalThis.Audio = vi.fn(function () { return { play: mockPlay } }) as any

      const engine = useAudioEngine()
      await engine.playImmediate('/audio/test.mp3')

      expect(Audio).toHaveBeenCalledWith('/audio/test.mp3')
      expect(mockPlay).toHaveBeenCalled()
    })
  })

  describe('scheduleSound', () => {
    it('schedules a buffer to play at a specific time', () => {
      const { mockCtx } = setupMockAudioContext()
      const buffer = createMockBuffer()

      const engine = useAudioEngine()
      const source = engine.scheduleSound(buffer, 1.5)

      expect(mockCtx.createBufferSource).toHaveBeenCalled()
      expect(source).toBeTruthy()
      expect(source!.start).toHaveBeenCalledWith(1.5)
    })

    it('returns null when Web Audio is unavailable', () => {
      globalThis.AudioContext = vi.fn(function () { throw new Error('not supported') }) as any

      const engine = useAudioEngine()
      const result = engine.scheduleSound(createMockBuffer(), 0)
      expect(result).toBeNull()
    })
  })

  describe('createBinauralBeat', () => {
    it('creates two oscillators with 10Hz frequency difference', () => {
      const { mockCtx } = setupMockAudioContext()

      const engine = useAudioEngine()
      const beat = engine.createBinauralBeat(200)

      expect(beat).toBeTruthy()
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2)
      expect(mockCtx.createChannelMerger).toHaveBeenCalledWith(2)
      expect(mockCtx.createGain).toHaveBeenCalledTimes(2)

      // Verify frequencies: left=200, right=210
      const oscillators = mockCtx.createOscillator.mock.results
      expect(oscillators[0].value.frequency.value).toBe(200)
      expect(oscillators[1].value.frequency.value).toBe(210)
    })

    it('stop() stops and disconnects oscillators', () => {
      const { mockCtx } = setupMockAudioContext()

      const engine = useAudioEngine()
      const beat = engine.createBinauralBeat(200)!
      beat.stop()

      const oscillators = mockCtx.createOscillator.mock.results
      expect(oscillators[0].value.stop).toHaveBeenCalled()
      expect(oscillators[1].value.stop).toHaveBeenCalled()
      expect(oscillators[0].value.disconnect).toHaveBeenCalled()
      expect(oscillators[1].value.disconnect).toHaveBeenCalled()
    })

    it('returns null when Web Audio is unavailable', () => {
      globalThis.AudioContext = vi.fn(function () { throw new Error('not supported') }) as any

      const engine = useAudioEngine()
      const result = engine.createBinauralBeat(200)
      expect(result).toBeNull()
    })
  })

  describe('isFallbackMode', () => {
    it('returns false when Web Audio is available', () => {
      setupMockAudioContext()
      const engine = useAudioEngine()
      engine.getAudioContext()
      expect(engine.isFallbackMode()).toBe(false)
    })

    it('returns true when Web Audio is unavailable', () => {
      globalThis.AudioContext = vi.fn(function () { throw new Error('not supported') }) as any
      const engine = useAudioEngine()
      engine.getAudioContext()
      expect(engine.isFallbackMode()).toBe(true)
    })
  })

  describe('getAudioContext', () => {
    it('returns the AudioContext instance', () => {
      setupMockAudioContext()
      const engine = useAudioEngine()
      const ctx = engine.getAudioContext()
      expect(ctx).toBeTruthy()
    })

    it('returns null when Web Audio is unavailable', () => {
      globalThis.AudioContext = vi.fn(function () { throw new Error('not supported') }) as any
      const engine = useAudioEngine()
      const ctx = engine.getAudioContext()
      expect(ctx).toBeNull()
    })
  })
})
