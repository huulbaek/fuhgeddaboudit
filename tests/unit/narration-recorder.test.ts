import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NarrationRecorder from '../../app/components/rtm/NarrationRecorder.vue'
import { _resetAudioEngine } from '../../app/composables/useAudioEngine'
import { useRtmNarration } from '../../app/composables/useRtmNarration'

function pcm(channels: Float32Array[], sampleRate = 4) {
  return {
    numberOfChannels: channels.length,
    length: channels[0]!.length,
    sampleRate,
    duration: channels[0]!.length / sampleRate,
    getChannelData: (i: number) => channels[i]!,
  }
}

describe('NarrationRecorder', () => {
  let rafCallbacks: Array<(t: number) => void>
  let mockNow: number
  let recorders: any[]
  let sources: any[]
  let getUserMedia: ReturnType<typeof vi.fn>

  function flushRAF(advanceMs: number) {
    mockNow += advanceMs
    const cbs = [...rafCallbacks]
    rafCallbacks = []
    cbs.forEach((cb) => cb(mockNow))
  }

  function installMedia(opts: { denied?: boolean; unsupported?: boolean } = {}) {
    const track = { stop: vi.fn() }
    const stream = { getTracks: () => [track] }
    getUserMedia = vi.fn(async () => {
      if (opts.denied) throw new DOMException('denied', 'NotAllowedError')
      return stream
    })
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })
    if (opts.unsupported) {
      delete (globalThis as any).MediaRecorder
      return
    }
    class MockMediaRecorder {
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      constructor() { recorders.push(this) }
      start = vi.fn(() => { this.state = 'recording' })
      stop = vi.fn(() => {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['abc']) })
        this.onstop?.()
      })
    }
    globalThis.MediaRecorder = MockMediaRecorder as any
  }

  beforeEach(() => {
    rafCallbacks = []
    mockNow = 0
    recorders = []
    sources = []
    _resetAudioEngine()
    useRtmNarration().clear()

    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb as any)
      return 1
    })
    globalThis.cancelAnimationFrame = vi.fn()

    globalThis.AudioContext = class MockAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume = vi.fn().mockResolvedValue(undefined)
      close = vi.fn().mockResolvedValue(undefined)
      decodeAudioData = vi.fn().mockResolvedValue(pcm([new Float32Array([1, 2, 3, 4])]))
      createBuffer = vi.fn((ch: number, len: number, sr: number) =>
        pcm(Array.from({ length: ch }, () => new Float32Array(len)), sr))

      createBufferSource = vi.fn(() => {
        const s = { buffer: null, playbackRate: { value: 1 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() }
        sources.push(s)
        return s
      })

      createGain = vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() }))
    } as any
  })

  afterEach(() => {
    useRtmNarration().clear()
    _resetAudioEngine()
    delete (globalThis as any).MediaRecorder
    delete (globalThis as any).AudioContext
    delete (globalThis.navigator as any).mediaDevices
    vi.restoreAllMocks()
  })

  function button(wrapper: any, label: string) {
    return wrapper.findAll('button').find((b: any) => b.text().includes(label))
  }

  it('offers Record and Skip initially', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder)
    expect(button(wrapper, 'Record')).toBeTruthy()
    expect(button(wrapper, 'Skip')).toBeTruthy()
  })

  it('emits skip when Skip is clicked', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder)
    await button(wrapper, 'Skip').trigger('click')
    expect(wrapper.emitted('skip')).toHaveLength(1)
  })

  it('explains and only offers Skip when recording is unsupported', async () => {
    installMedia({ unsupported: true })
    const wrapper = await mountSuspended(NarrationRecorder)
    expect(wrapper.text()).toContain("doesn't support")
    expect(button(wrapper, 'Record')).toBeUndefined()
    expect(button(wrapper, 'Skip')).toBeTruthy()
  })

  it('starts recording and shows a countdown with a Stop button', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder, { props: { maxMs: 30000 } })

    await button(wrapper, 'Record').trigger('click')
    await flushPromises(wrapper)
    flushRAF(5000)
    await wrapper.vm.$nextTick()

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(wrapper.text()).toContain('25')
    expect(button(wrapper, 'Stop')).toBeTruthy()
  })

  it('shows a permission error with Skip when the mic is denied', async () => {
    installMedia({ denied: true })
    const wrapper = await mountSuspended(NarrationRecorder)

    await button(wrapper, 'Record').trigger('click')
    await flushPromises(wrapper)

    expect(wrapper.text()).toContain('Microphone access was denied')
    expect(button(wrapper, 'Skip')).toBeTruthy()
  })

  it('stores the reversed recording and offers Continue after Stop', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder)
    await button(wrapper, 'Record').trigger('click')
    await flushPromises(wrapper)

    await button(wrapper, 'Stop').trigger('click')
    await flushPromises(wrapper)

    const stored = useRtmNarration().get()
    expect(stored).toBeTruthy()
    expect(Array.from(stored!.getChannelData(0))).toEqual([4, 3, 2, 1])
    expect(button(wrapper, 'Continue')).toBeTruthy()
    expect(button(wrapper, 'Re-record')).toBeTruthy()
  })

  it('emits complete when Continue is clicked after recording', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder)
    await button(wrapper, 'Record').trigger('click')
    await flushPromises(wrapper)
    await button(wrapper, 'Stop').trigger('click')
    await flushPromises(wrapper)

    await button(wrapper, 'Continue').trigger('click')

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('plays the forward recording for preview', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder)
    await button(wrapper, 'Record').trigger('click')
    await flushPromises(wrapper)
    await button(wrapper, 'Stop').trigger('click')
    await flushPromises(wrapper)

    await button(wrapper, 'Preview').trigger('click')
    await flushPromises(wrapper)

    expect(sources).toHaveLength(1)
    expect(Array.from(sources[0].buffer.getChannelData(0))).toEqual([1, 2, 3, 4])
  })

  it('auto-stops when the time limit is reached', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder, { props: { maxMs: 10000 } })
    await button(wrapper, 'Record').trigger('click')
    await flushPromises(wrapper)

    flushRAF(10000)
    await flushPromises(wrapper)

    expect(recorders[0].stop).toHaveBeenCalled()
    expect(useRtmNarration().has()).toBe(true)
    expect(button(wrapper, 'Continue')).toBeTruthy()
  })

  it('releases the microphone when unmounted mid-recording', async () => {
    installMedia()
    const wrapper = await mountSuspended(NarrationRecorder)
    await button(wrapper, 'Record').trigger('click')
    await flushPromises(wrapper)

    wrapper.unmount()

    expect(recorders[0].stop).toHaveBeenCalled()
    expect(useRtmNarration().has()).toBe(false)
  })
})

async function flushPromises(wrapper: any) {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
    await wrapper.vm.$nextTick()
  }
}
