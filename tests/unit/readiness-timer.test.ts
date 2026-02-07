import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReadinessTimer from '../../app/components/preparation/ReadinessTimer.vue'

// Mock performance.now and requestAnimationFrame
let mockNow = 0
let rafCallbacks: FrameRequestCallback[] = []
let rafIdCounter = 1

function flushRAF(advanceMs: number) {
  mockNow += advanceMs
  const cbs = [...rafCallbacks]
  rafCallbacks = []
  for (const cb of cbs) {
    cb(mockNow)
  }
}

describe('ReadinessTimer', () => {
  beforeEach(() => {
    mockNow = 1000
    rafCallbacks = []
    rafIdCounter = 1
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      const id = rafIdCounter++
      rafCallbacks.push(cb)
      return id
    })
    globalThis.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders heading and instructions', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    expect(wrapper.find('h2').text()).toBe('Readiness Check')
    expect(wrapper.text()).toContain('press and hold the button')
  })

  it('shows hold button in idle state', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))
    expect(btn).toBeTruthy()
  })

  it('starts timer on mousedown and shows countdown', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    // Advance a bit to see countdown
    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Keep Holding')
    expect(wrapper.text()).toContain('29s')
  })

  it('shows breathing pacer label while holding', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    // During first half of 8s cycle = inhale
    flushRAF(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Breathe in...')

    // Advance to exhale phase (past 4s in the cycle)
    flushRAF(4000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Breathe out...')
  })

  it('emits retry when released early', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    flushRAF(5000)
    await wrapper.vm.$nextTick()

    // Release early
    const holdBtn = wrapper.findAll('button').find(b => b.text().includes('Keep Holding'))!
    await holdBtn.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const retryEmitted = wrapper.emitted('retry')
    expect(retryEmitted).toBeTruthy()
    expect(wrapper.text()).toContain('released early')
  })

  it('shows try again button after early release', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const holdBtn = wrapper.findAll('button').find(b => b.text().includes('Keep Holding'))!
    await holdBtn.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const tryAgainBtn = wrapper.findAll('button').find(b => b.text().includes('Try Again'))
    expect(tryAgainBtn).toBeTruthy()
  })

  it('returns to idle after clicking try again', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    flushRAF(1000)
    await wrapper.vm.$nextTick()

    const holdBtn = wrapper.findAll('button').find(b => b.text().includes('Keep Holding'))!
    await holdBtn.trigger('mouseup')
    await wrapper.vm.$nextTick()

    const tryAgainBtn = wrapper.findAll('button').find(b => b.text().includes('Try Again'))!
    await tryAgainBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const holdBtnAgain = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))
    expect(holdBtnAgain).toBeTruthy()
  })

  it('emits success after holding for 30 seconds', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    // Simulate holding for 30 seconds via multiple RAF ticks
    for (let i = 0; i < 30; i++) {
      flushRAF(1000)
      await wrapper.vm.$nextTick()
    }

    const successEmitted = wrapper.emitted('success')
    expect(successEmitted).toBeTruthy()
    expect(wrapper.text()).toContain('Well done')
    expect(wrapper.text()).toContain('ready')
  })

  it('shows progress bar while holding', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    flushRAF(15000)
    await wrapper.vm.$nextTick()

    // Should show a progress bar element
    const progressBar = wrapper.find('.bg-emerald-500')
    expect(progressBar.exists()).toBe(true)
    // At 15s of 30s, should be ~50%
    const style = progressBar.attributes('style')
    expect(style).toContain('50%')
  })

  it('does not restart after passing', async () => {
    const wrapper = await mountSuspended(ReadinessTimer)
    const btn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))!
    await btn.trigger('mousedown')

    for (let i = 0; i < 30; i++) {
      flushRAF(1000)
      await wrapper.vm.$nextTick()
    }

    // Should be in passed state, no hold button
    const holdBtn = wrapper.findAll('button').find(b => b.text().includes('Press & Hold'))
    expect(holdBtn).toBeUndefined()
  })
})
