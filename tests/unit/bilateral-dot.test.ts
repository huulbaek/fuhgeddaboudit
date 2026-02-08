import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BilateralDot from '../../app/components/emdr/BilateralDot.vue'
import { _resetAudioEngine } from '../../app/composables/useAudioEngine'

function createMockPanner() {
  return {
    pan: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function createMockOscillator() {
  return {
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  }
}

function createMockGain() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function setupMockAudioContext() {
  const panners: ReturnType<typeof createMockPanner>[] = []
  const oscillators: ReturnType<typeof createMockOscillator>[] = []
  const gains: ReturnType<typeof createMockGain>[] = []

  const mockCtx = {
    state: 'running' as string,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    destination: {},
    createStereoPanner: vi.fn(() => {
      const p = createMockPanner()
      panners.push(p)
      return p
    }),
    createOscillator: vi.fn(() => {
      const o = createMockOscillator()
      oscillators.push(o)
      return o
    }),
    createGain: vi.fn(() => {
      const g = createMockGain()
      gains.push(g)
      return g
    }),
    createBufferSource: vi.fn(),
    decodeAudioData: vi.fn(),
    createChannelMerger: vi.fn(),
  }

  globalThis.AudioContext = vi.fn(function () { return mockCtx }) as any

  return { mockCtx, panners, oscillators, gains }
}

describe('BilateralDot', () => {
  let rafCallbacks: Array<(time: number) => void> = []
  let rafIdCounter = 1
  let mockNow = 0

  beforeEach(() => {
    rafCallbacks = []
    rafIdCounter = 1
    mockNow = 0

    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)

    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      const id = rafIdCounter++
      rafCallbacks.push(cb as (time: number) => void)
      return id
    })

    globalThis.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    _resetAudioEngine()
    vi.restoreAllMocks()
    delete (globalThis as any).AudioContext
  })

  function flushRAF(advanceMs: number) {
    mockNow += advanceMs
    const cbs = [...rafCallbacks]
    rafCallbacks = []
    for (const cb of cbs) {
      cb(mockNow)
    }
  }

  it('renders with correct aria attributes', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const region = wrapper.find('[role="img"]')
    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-label')).toBe('Bilateral stimulation dot')
  })

  it('renders the dot element', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const dot = wrapper.find('[data-testid="bilateral-dot"]')
    expect(dot.exists()).toBe(true)
  })

  it('dot is hidden when not running', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const dot = wrapper.find('[data-testid="bilateral-dot"]')
    expect(dot.classes()).toContain('opacity-0')
  })

  it('dot is visible when running', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const vm = wrapper.vm as any
    await vm.start()
    await wrapper.vm.$nextTick()

    const dot = wrapper.find('[data-testid="bilateral-dot"]')
    expect(dot.classes()).not.toContain('opacity-0')

    vm.stop()
  })

  it('position starts at 0 (left)', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const vm = wrapper.vm as any
    expect(vm.position).toBe(0)
  })

  it('position moves to 1 (right) at half a cycle', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // At 1000ms, dot should be at the right edge (position = 1)
    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(vm.position).toBeCloseTo(1, 1)

    vm.stop()
  })

  it('position returns to 0 (left) after a full cycle', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // Full cycle = 2 * speedMs = 2000ms → back to left
    flushRAF(2000)
    await wrapper.vm.$nextTick()

    expect(vm.position).toBeCloseTo(0, 1)

    vm.stop()
  })

  it('position is at midpoint (0.5) at quarter cycle', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // At 500ms (quarter of full 2000ms cycle), position should be 0.5
    flushRAF(500)
    await wrapper.vm.$nextTick()

    expect(vm.position).toBeCloseTo(0.5, 1)

    vm.stop()
  })

  it('oscillates continuously across multiple cycles', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // Cycle 1: right
    flushRAF(1000)
    await wrapper.vm.$nextTick()
    expect(vm.position).toBeCloseTo(1, 1)

    // Cycle 1: back to left
    flushRAF(1000)
    await wrapper.vm.$nextTick()
    expect(vm.position).toBeCloseTo(0, 1)

    // Cycle 2: right again
    flushRAF(1000)
    await wrapper.vm.$nextTick()
    expect(vm.position).toBeCloseTo(1, 1)

    vm.stop()
  })

  it('emits pass event at each direction change', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // First pass at 1000ms (reached right edge)
    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('pass')).toHaveLength(1)

    // Second pass at 2000ms (returned to left)
    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('pass')).toHaveLength(2)

    vm.stop()
  })

  it('respects custom speedMs prop', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 500 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    // At 500ms with speedMs=500, should be at right edge
    flushRAF(500)
    await wrapper.vm.$nextTick()

    expect(vm.position).toBeCloseTo(1, 1)

    vm.stop()
  })

  it('defaults to 1000ms speed', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const vm = wrapper.vm as any
    await vm.start()

    // At 500ms with default 1000ms speed, should be at midpoint
    flushRAF(500)
    await wrapper.vm.$nextTick()

    expect(vm.position).toBeCloseTo(0.5, 1)

    vm.stop()
  })

  it('can be stopped', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()
    expect(vm.running).toBe(true)

    vm.stop()
    expect(vm.running).toBe(false)
  })

  it('exposes running state', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const vm = wrapper.vm as any
    expect(vm.running).toBe(false)

    await vm.start()
    expect(vm.running).toBe(true)

    vm.stop()
    expect(vm.running).toBe(false)
  })

  it('exposes position state', async () => {
    const wrapper = await mountSuspended(BilateralDot)

    const vm = wrapper.vm as any
    expect(vm.position).toBe(0)
  })

  it('resets position on start', async () => {
    const wrapper = await mountSuspended(BilateralDot, {
      props: { speedMs: 1000 },
    })

    const vm = wrapper.vm as any
    await vm.start()

    flushRAF(500)
    await wrapper.vm.$nextTick()
    expect(vm.position).toBeCloseTo(0.5, 1)

    vm.stop()

    // Restart should reset position to 0
    await vm.start()
    expect(vm.position).toBe(0)

    vm.stop()
  })

  describe('bilateral audio tones', () => {
    it('does not create audio nodes when audioEnabled is false', async () => {
      const { mockCtx } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: false },
      })

      const vm = wrapper.vm as any
      await vm.start()

      expect(mockCtx.createOscillator).not.toHaveBeenCalled()
      expect(mockCtx.createStereoPanner).not.toHaveBeenCalled()

      vm.stop()
    })

    it('creates oscillator, gain, and stereo panner when audioEnabled is true', async () => {
      const { mockCtx } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1)
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1)
      expect(mockCtx.createStereoPanner).toHaveBeenCalledTimes(1)

      vm.stop()
    })

    it('connects oscillator → gain → panner → destination', async () => {
      const { mockCtx, oscillators, gains, panners } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      const osc = oscillators[0]
      const gain = gains[0]
      const panner = panners[0]

      expect(osc.connect).toHaveBeenCalledWith(gain)
      expect(gain.connect).toHaveBeenCalledWith(panner)
      expect(panner.connect).toHaveBeenCalledWith(mockCtx.destination)

      vm.stop()
    })

    it('starts panner at -1 (full left)', async () => {
      const { panners } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      expect(panners[0].pan.value).toBe(-1)

      vm.stop()
    })

    it('pans to +1 (full right) when dot reaches right edge', async () => {
      const { panners } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      // At 1000ms, position = 1, pan should be 1*2-1 = +1
      flushRAF(1000)
      await wrapper.vm.$nextTick()

      expect(panners[0].pan.value).toBeCloseTo(1, 1)

      vm.stop()
    })

    it('pans back to -1 (full left) when dot returns to left', async () => {
      const { panners } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      // Full cycle = 2000ms → back to left, pan = 0*2-1 = -1
      flushRAF(2000)
      await wrapper.vm.$nextTick()

      expect(panners[0].pan.value).toBeCloseTo(-1, 1)

      vm.stop()
    })

    it('pans to center (0) at midpoint', async () => {
      const { panners } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      // At 500ms, position = 0.5, pan = 0.5*2-1 = 0
      flushRAF(500)
      await wrapper.vm.$nextTick()

      expect(panners[0].pan.value).toBeCloseTo(0, 1)

      vm.stop()
    })

    it('uses the toneFrequency prop for oscillator frequency', async () => {
      const { oscillators } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true, toneFrequency: 330 },
      })

      const vm = wrapper.vm as any
      await vm.start()

      expect(oscillators[0].frequency.value).toBe(330)

      vm.stop()
    })

    it('defaults toneFrequency to 440 Hz', async () => {
      const { oscillators } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      expect(oscillators[0].frequency.value).toBe(440)

      vm.stop()
    })

    it('sets gain to 0.3', async () => {
      const { gains } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      expect(gains[0].gain.value).toBe(0.3)

      vm.stop()
    })

    it('stops and disconnects audio nodes on stop', async () => {
      const { oscillators, gains, panners } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()
      vm.stop()

      expect(oscillators[0].stop).toHaveBeenCalled()
      expect(oscillators[0].disconnect).toHaveBeenCalled()
      expect(gains[0].disconnect).toHaveBeenCalled()
      expect(panners[0].disconnect).toHaveBeenCalled()
    })

    it('starts oscillator on start', async () => {
      const { oscillators } = setupMockAudioContext()

      const wrapper = await mountSuspended(BilateralDot, {
        props: { speedMs: 1000, audioEnabled: true },
      })

      const vm = wrapper.vm as any
      await vm.start()

      expect(oscillators[0].start).toHaveBeenCalled()

      vm.stop()
    })
  })
})
