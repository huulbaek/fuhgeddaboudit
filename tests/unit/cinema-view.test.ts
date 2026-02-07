import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CinemaView from '../../app/components/rtm/CinemaView.vue'

describe('CinemaView', () => {
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

    // Mock AudioContext for binaural beat
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      destination: {},
      createOscillator: vi.fn(() => ({
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
      })),
      createChannelMerger: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
    })) as any
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
    const wrapper = await mountSuspended(CinemaView)

    const region = wrapper.find('[role="region"]')
    expect(region.exists()).toBe(true)
    expect(region.attributes('aria-label')).toBe('Cinema forward pass')

    // Default labels A and B
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
  })

  it('renders custom start and end labels', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { startLabel: 'Morning coffee', endLabel: 'Walking the dog' },
    })

    expect(wrapper.text()).toContain('Morning coffee')
    expect(wrapper.text()).toContain('Walking the dog')
  })

  it('renders a progressbar with correct initial aria attributes', async () => {
    const wrapper = await mountSuspended(CinemaView)

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('aria-valuenow')).toBe('0')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(bar.attributes('aria-label')).toBe('Forward pass progress')
  })

  it('shows remaining time initially', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 5000 },
    })

    expect(wrapper.text()).toContain('5s')
  })

  it('shows minutes:seconds format for durations >= 60s', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 120000 },
    })

    expect(wrapper.text()).toContain('2:00')
  })

  it('has the film grain overlay element', async () => {
    const wrapper = await mountSuspended(CinemaView)

    const grain = wrapper.find('.cinema-grain')
    expect(grain.exists()).toBe(true)
  })

  it('applies grayscale filter to the main content', async () => {
    const wrapper = await mountSuspended(CinemaView)

    const content = wrapper.find('.grayscale')
    expect(content.exists()).toBe(true)
  })

  it('updates progress when started and RAF fires', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(500)
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('50')

    vm.stop()
  })

  it('updates progress bar width style', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 2000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const innerBar = wrapper.find('.bg-gray-300')
    expect(innerBar.attributes('style')).toContain('width: 50%')

    vm.stop()
  })

  it('emits complete when duration is reached', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted).toHaveLength(1)
  })

  it('clamps progress to 100% and does not emit multiple completes', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(1500)
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('100')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toHaveLength(1)
  })

  it('can be stopped before completion', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 5000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    vm.stop()

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeFalsy()
  })

  it('shows decreasing remaining time as progress advances', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 10000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(5000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('5s')

    flushRAF(3000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('2s')

    vm.stop()
  })

  it('shows 0s remaining when complete', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('0s')
  })

  it('defaults to 45000ms duration', async () => {
    const wrapper = await mountSuspended(CinemaView)

    // 45000ms = 45s remaining initially
    expect(wrapper.text()).toContain('45s')
  })

  it('exposes running state', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 5000 },
    })

    const vm = wrapper.vm as any
    expect(vm.running).toBe(false)

    vm.start()
    expect(vm.running).toBe(true)

    vm.stop()
    expect(vm.running).toBe(false)
  })

  it('sets running to false on completion', async () => {
    const wrapper = await mountSuspended(CinemaView, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()
    expect(vm.running).toBe(true)

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(vm.running).toBe(false)
    expect(vm.completed).toBe(true)
  })
})
