import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RewindAnimation from '../../app/components/rtm/RewindAnimation.vue'
import { _resetAudioEngine } from '../../app/composables/useAudioEngine'

describe('RewindAnimation', () => {
  let rafCallbacks: Array<(time: number) => void> = []
  let rafIdCounter = 1
  let mockNow = 0

  beforeEach(() => {
    rafCallbacks = []
    rafIdCounter = 1
    mockNow = 0

    // Reset audio engine singleton state before each test
    _resetAudioEngine()

    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)

    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      const id = rafIdCounter++
      rafCallbacks.push(cb as (time: number) => void)
      return id
    })

    globalThis.cancelAnimationFrame = vi.fn()

    // Mock AudioContext as a proper class constructor
    globalThis.AudioContext = class MockAudioContext {
      state = 'running'
      destination = {}
      resume = vi.fn().mockResolvedValue(undefined)
      close = vi.fn().mockResolvedValue(undefined)
      decodeAudioData = vi.fn().mockResolvedValue({
        duration: 1.5,
        length: 66150,
        numberOfChannels: 2,
        sampleRate: 44100,
      })
      createBufferSource = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }))
      createGain = vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
      }))
    } as any

    // Mock fetch for audio preloading
    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushRAF(advanceMs: number) {
    mockNow += advanceMs
    const cbs = [...rafCallbacks]
    rafCallbacks = []
    for (const cb of cbs) {
      cb(mockNow)
    }
  }

  it('renders with default props', async () => {
    const wrapper = await mountSuspended(RewindAnimation)

    const region = wrapper.find('[role="region"]')
    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-label')).toBe('Cinema rewind pass')

    // Default labels A and B
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
  })

  it('renders custom start and end labels', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { startLabel: 'Morning coffee', endLabel: 'Walking the dog' },
    })

    expect(wrapper.text()).toContain('Morning coffee')
    expect(wrapper.text()).toContain('Walking the dog')
  })

  it('renders in color (no grayscale class)', async () => {
    const wrapper = await mountSuspended(RewindAnimation)

    // Hard cut to color — no grayscale filter should be applied
    const grayscaleEl = wrapper.find('.grayscale')
    expect(grayscaleEl.exists()).toBe(false)
  })

  it('has no film grain overlay (color mode)', async () => {
    const wrapper = await mountSuspended(RewindAnimation)

    const grain = wrapper.find('.cinema-grain')
    expect(grain.exists()).toBe(false)
  })

  it('renders a progressbar starting at 100% (position B)', async () => {
    const wrapper = await mountSuspended(RewindAnimation)

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('aria-valuenow')).toBe('0')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(bar.attributes('aria-label')).toBe('Rewind pass progress')
  })

  it('shows "Ready" text before starting', async () => {
    const wrapper = await mountSuspended(RewindAnimation)

    expect(wrapper.text()).toContain('Ready')
  })

  it('shows "Rewinding..." text when active', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1500 },
    })

    const vm = wrapper.vm as any
    await vm.start()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Rewinding...')

    vm.stop()
  })

  it('progress goes from 1 (B) to 0 (A) during rewind', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // At start, progress should be 1 (at B)
    expect(vm.progress).toBe(1)

    // Halfway through
    flushRAF(500)
    await wrapper.vm.$nextTick()

    expect(vm.progress).toBeCloseTo(0.5)

    vm.stop()
  })

  it('updates the progress bar width as it rewinds', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 2000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const innerBar = wrapper.find('.bg-amber-400')
    expect(innerBar.attributes('style')).toContain('width: 50%')

    vm.stop()
  })

  it('emits complete when rewind finishes', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted).toHaveLength(1)
  })

  it('shows "Rewind complete" when finished', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Rewind complete')
  })

  it('clamps progress at 0 and does not emit multiple completes', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    flushRAF(1500)
    await wrapper.vm.$nextTick()

    expect(vm.progress).toBe(0)

    const emitted = wrapper.emitted('complete')
    expect(emitted).toHaveLength(1)
  })

  it('can be stopped before completion', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 5000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    vm.stop()

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeFalsy()
  })

  it('defaults to 1500ms duration', async () => {
    const wrapper = await mountSuspended(RewindAnimation)

    const vm = wrapper.vm as any
    await vm.start()

    // Should not be complete at 1000ms
    flushRAF(1000)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('complete')).toBeFalsy()

    // Should be complete at 1500ms
    flushRAF(500)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('complete')).toBeTruthy()
  })

  it('exposes running state', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 5000 },
    })

    const vm = wrapper.vm as any
    expect(vm.running).toBe(false)

    await vm.start()
    expect(vm.running).toBe(true)

    vm.stop()
    expect(vm.running).toBe(false)
  })

  it('sets running to false on completion', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()
    expect(vm.running).toBe(true)

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(vm.running).toBe(false)
    expect(vm.completed).toBe(true)
  })

  it('attempts to play rewind-whoosh.mp3 on start', async () => {
    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1500 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // Verify fetch was called for the audio file
    expect(globalThis.fetch).toHaveBeenCalledWith('/audio/rewind-whoosh.mp3')

    vm.stop()
  })

  it('continues animation even if audio fails', async () => {
    // Make audio fail
    ;(globalThis.fetch as any).mockRejectedValue(new Error('Audio not found'))

    const wrapper = await mountSuspended(RewindAnimation, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    // Animation should still complete even though audio failed
    expect(vm.completed).toBe(true)
    expect(wrapper.emitted('complete')).toBeTruthy()
  })

  it('uses amber color scheme (distinguishing from grayscale forward pass)', async () => {
    const wrapper = await mountSuspended(RewindAnimation)

    // The progress bar should use amber color (not gray like CinemaView)
    const innerBar = wrapper.find('.bg-amber-400')
    expect(innerBar.exists()).toBe(true)

    // Labels should be amber
    const labels = wrapper.findAll('.text-amber-400')
    expect(labels.length).toBe(2)
  })
})
