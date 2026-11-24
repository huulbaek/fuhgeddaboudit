import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TimerBar from '../../app/components/shared/TimerBar.vue'

describe('TimerBar', () => {
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

  it('renders a progressbar with correct aria attributes', async () => {
    const wrapper = await mountSuspended(TimerBar, {
      props: { durationMs: 5000 },
    })

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('aria-valuenow')).toBe('0')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
  })

  it('shows remaining time text', async () => {
    const wrapper = await mountSuspended(TimerBar, {
      props: { durationMs: 5000 },
    })

    // Initially should show 5s
    expect(wrapper.text()).toContain('5s')
  })

  it('shows minutes:seconds format for durations >= 60s', async () => {
    const wrapper = await mountSuspended(TimerBar, {
      props: { durationMs: 120000 },
    })

    expect(wrapper.text()).toContain('2:00')
  })

  it('updates progress when started and RAF fires', async () => {
    const wrapper = await mountSuspended(TimerBar, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    // Advance 500ms (50%)
    flushRAF(500)
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('50')

    vm.stop()
  })

  it('emits complete when duration is reached', async () => {
    const wrapper = await mountSuspended(TimerBar, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    // Advance past the duration
    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted).toHaveLength(1)
  })

  it('clamps progress to 100% and does not emit multiple completes', async () => {
    const wrapper = await mountSuspended(TimerBar, {
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

  it('updates the progress bar width style', async () => {
    const wrapper = await mountSuspended(TimerBar, {
      props: { durationMs: 2000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const innerBar = wrapper.find('[role="progressbar"] [style*="width"]')
    expect(innerBar.attributes('style')).toContain('width: 50%')
  })

  it('can be stopped before completion', async () => {
    const wrapper = await mountSuspended(TimerBar, {
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
    const wrapper = await mountSuspended(TimerBar, {
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
    const wrapper = await mountSuspended(TimerBar, {
      props: { durationMs: 1000 },
    })

    const vm = wrapper.vm as any
    vm.start()

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('0s')
  })
})
