import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RewindAnimation from '../../app/components/rtm/RewindAnimation.vue'
import { _resetAudioEngine } from '../../app/composables/useAudioEngine'
import { useRtmNarration } from '../../app/composables/useRtmNarration'

const narrationBuffer = { duration: 12, length: 12, sampleRate: 1, numberOfChannels: 1 } as unknown as AudioBuffer
const whooshBuffer = { duration: 1.5, length: 66150, sampleRate: 44100, numberOfChannels: 2 } as unknown as AudioBuffer

describe('RewindAnimation narration playback', () => {
  let sources: any[]
  let gains: any[]

  beforeEach(() => {
    sources = []
    gains = []
    _resetAudioEngine()
    useRtmNarration().clear()

    vi.spyOn(performance, 'now').mockImplementation(() => 0)
    globalThis.requestAnimationFrame = vi.fn(() => 1)
    globalThis.cancelAnimationFrame = vi.fn()

    globalThis.AudioContext = class MockAudioContext {
      state = 'running'
      currentTime = 42
      destination = {}
      resume = vi.fn().mockResolvedValue(undefined)
      close = vi.fn().mockResolvedValue(undefined)
      decodeAudioData = vi.fn().mockResolvedValue(whooshBuffer)
      createBufferSource = vi.fn(() => {
        const s = { buffer: null, playbackRate: { value: 1 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() }
        sources.push(s)
        return s
      })

      createGain = vi.fn(() => {
        const g = { gain: { value: 1 }, connect: vi.fn() }
        gains.push(g)
        return g
      })
    } as any

    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }) as any
  })

  afterEach(() => {
    useRtmNarration().clear()
    _resetAudioEngine()
    vi.restoreAllMocks()
  })

  it('plays the stored narration sped up to fit the rewind, layered over the whoosh', async () => {
    useRtmNarration().set(narrationBuffer)
    const wrapper = await mountSuspended(RewindAnimation, { props: { durationMs: 1500 } })

    await (wrapper.vm as any).start()

    const voice = sources.find((s) => s.buffer === narrationBuffer)
    const whoosh = sources.find((s) => s.buffer === whooshBuffer)
    expect(voice).toBeTruthy()
    expect(whoosh).toBeTruthy()
    expect(voice.playbackRate.value).toBe(8)
    // Both scheduled on the same audio-clock tick
    expect(voice.start).toHaveBeenCalledWith(42)
    expect(whoosh.start).toHaveBeenCalledWith(42)
    // Whoosh ducked under the voice
    const whooshGain = gains[sources.indexOf(whoosh)]
    const voiceGain = gains[sources.indexOf(voice)]
    expect(whooshGain.gain.value).toBeLessThan(voiceGain.gain.value)

    ;(wrapper.vm as any).stop()
  })

  it('plays only the whoosh when no narration is stored', async () => {
    const wrapper = await mountSuspended(RewindAnimation, { props: { durationMs: 1500 } })

    await (wrapper.vm as any).start()

    expect(sources).toHaveLength(1)
    expect(sources[0].buffer).toBe(whooshBuffer)
    expect(sources[0].playbackRate.value).toBe(1)

    ;(wrapper.vm as any).stop()
  })

  it('stops the narration source when the rewind is stopped early', async () => {
    useRtmNarration().set(narrationBuffer)
    const wrapper = await mountSuspended(RewindAnimation, { props: { durationMs: 1500 } })
    await (wrapper.vm as any).start()
    const voice = sources.find((s) => s.buffer === narrationBuffer)

    ;(wrapper.vm as any).stop()

    expect(voice.stop).toHaveBeenCalled()
  })
})
