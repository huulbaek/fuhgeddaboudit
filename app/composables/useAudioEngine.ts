const bufferCache = new Map<string, AudioBuffer>()

let audioContext: AudioContext | null = null
let fallbackMode = false

function getContext(): AudioContext | null {
  if (fallbackMode) return null
  if (audioContext) return audioContext
  try {
    audioContext = new AudioContext()
    return audioContext
  } catch {
    fallbackMode = true
    console.warn('[useAudioEngine] Web Audio API unavailable — falling back to HTML5 <audio>')
    return null
  }
}

async function ensureResumed(): Promise<boolean> {
  const ctx = getContext()
  if (!ctx) return false
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return false
    }
  }
  return ctx.state === 'running'
}

/**
 * Return a new buffer whose samples are the reverse of `buffer`, channel by channel.
 * The input buffer is left untouched.
 */
export function reverseAudioBuffer(buffer: AudioBuffer, ctx: AudioContext): AudioBuffer {
  const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch)
    const dst = reversed.getChannelData(ch)
    const last = src.length - 1
    for (let i = 0; i <= last; i++) {
      dst[i] = src[last - i]!
    }
  }
  return reversed
}

/**
 * Playback rate needed to squeeze `durationSec` of audio into `targetMs`.
 * Never slower than real time.
 */
export function playbackRateToFit(durationSec: number, targetMs: number): number {
  return Math.max(1, (durationSec * 1000) / targetMs)
}

export interface PlayBufferOptions {
  startTime?: number
  playbackRate?: number
  gain?: number
}

export function useAudioEngine() {
  async function preload(src: string): Promise<AudioBuffer | null> {
    if (bufferCache.has(src)) return bufferCache.get(src)!
    const ctx = getContext()
    if (!ctx) return null
    const response = await fetch(src)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    bufferCache.set(src, audioBuffer)
    return audioBuffer
  }

  async function playImmediate(src: string): Promise<void> {
    const ctx = getContext()
    if (!ctx || !(await ensureResumed())) {
      // Fallback to HTML5 <audio>
      const audio = new Audio(src)
      await audio.play()
      return
    }
    const buffer = await preload(src)
    if (!buffer) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  }

  function scheduleSound(buffer: AudioBuffer, startTime: number): AudioBufferSourceNode | null {
    const ctx = getContext()
    if (!ctx) return null
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(startTime)
    return source
  }

  function createBinauralBeat(freq: number): { stop: () => void } | null {
    const ctx = getContext()
    if (!ctx) return null
    const leftOsc = ctx.createOscillator()
    const rightOsc = ctx.createOscillator()
    const merger = ctx.createChannelMerger(2)

    leftOsc.frequency.value = freq
    rightOsc.frequency.value = freq + 10 // 10 Hz binaural beat difference

    const leftGain = ctx.createGain()
    const rightGain = ctx.createGain()
    leftGain.gain.value = 0.3
    rightGain.gain.value = 0.3

    leftOsc.connect(leftGain)
    rightOsc.connect(rightGain)
    leftGain.connect(merger, 0, 0)
    rightGain.connect(merger, 0, 1)
    merger.connect(ctx.destination)

    leftOsc.start()
    rightOsc.start()

    return {
      stop() {
        leftOsc.stop()
        rightOsc.stop()
        leftOsc.disconnect()
        rightOsc.disconnect()
        merger.disconnect()
      },
    }
  }

  async function playBuffer(
    buffer: AudioBuffer,
    options: PlayBufferOptions = {},
  ): Promise<AudioBufferSourceNode | null> {
    const ctx = getContext()
    if (!ctx || !(await ensureResumed())) return null
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = options.playbackRate ?? 1
    const gainNode = ctx.createGain()
    gainNode.gain.value = options.gain ?? 1
    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    source.start(options.startTime ?? 0)
    return source
  }

  function getAudioContext(): AudioContext | null {
    return getContext()
  }

  function isFallbackMode(): boolean {
    return fallbackMode
  }

  return {
    preload,
    playImmediate,
    scheduleSound,
    createBinauralBeat,
    playBuffer,
    getAudioContext,
    isFallbackMode,
  }
}

/**
 * Reset internal state — only for testing.
 */
export function _resetAudioEngine() {
  if (audioContext) {
    audioContext.close().catch(() => {})
    audioContext = null
  }
  bufferCache.clear()
  fallbackMode = false
}
