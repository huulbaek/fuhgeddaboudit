import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { nextTick } from 'vue'
import VigilanceTask from '../../app/components/tnt/VigilanceTask.vue'

describe('TNT VigilanceTask', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('performance', { now: vi.fn(() => 1000) })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not render overlay when inactive', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    expect(wrapper.find('[data-testid="vigilance-overlay"]').exists()).toBe(false)
  })

  it('renders overlay when started', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()
    expect(wrapper.find('[data-testid="vigilance-overlay"]').exists()).toBe(true)
  })

  it('shows border flicker after scheduled interval', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    // No flicker yet
    expect(wrapper.find('.border-yellow-400').exists()).toBe(false)

    // Advance past max interval (17s)
    vi.advanceTimersByTime(18_000)
    await nextTick()

    expect(wrapper.find('.border-yellow-400').exists()).toBe(true)
    expect(wrapper.find('[data-testid="vigilance-prompt"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="vigilance-prompt"]').text()).toBe('Press spacebar')
  })

  it('logs reaction time when spacebar pressed during flicker', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    // Trigger flicker directly
    ;(wrapper.vm as any).showFlicker()
    await nextTick()

    expect(wrapper.find('.border-yellow-400').exists()).toBe(true)

    // Simulate 250ms later
    vi.stubGlobal('performance', { now: vi.fn(() => 1250) })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await nextTick()

    expect(wrapper.emitted('flickerLogged')).toBeTruthy()
    const log = wrapper.emitted('flickerLogged')![0][0] as any
    expect(log.reactionTimeMs).toBe(250)
    expect(log.responded).toBe(true)
    expect(log.flickerIndex).toBe(1)

    // Flicker should be dismissed
    expect(wrapper.find('.border-yellow-400').exists()).toBe(false)
  })

  it('logs missed flicker when no response within timeout', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    // Trigger flicker directly
    ;(wrapper.vm as any).showFlicker()
    await nextTick()

    expect(wrapper.find('.border-yellow-400').exists()).toBe(true)

    // Advance past flicker timeout (3s)
    vi.advanceTimersByTime(3_100)
    await nextTick()

    expect(wrapper.emitted('flickerLogged')).toBeTruthy()
    const log = wrapper.emitted('flickerLogged')![0][0] as any
    expect(log.reactionTimeMs).toBeNull()
    expect(log.responded).toBe(false)

    // Flicker should be dismissed
    expect(wrapper.find('.border-yellow-400').exists()).toBe(false)
  })

  it('ignores spacebar when not flickering', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    // Press spacebar when no flicker is active
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await nextTick()

    expect(wrapper.emitted('flickerLogged')).toBeFalsy()
  })

  it('ignores other keys during flicker', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    ;(wrapper.vm as any).showFlicker()
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await nextTick()

    expect(wrapper.emitted('flickerLogged')).toBeFalsy()
    // Flicker should still be active
    expect(wrapper.find('.border-yellow-400').exists()).toBe(true)
  })

  it('stops and cleans up correctly', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    ;(wrapper.vm as any).stop()
    await nextTick()

    expect(wrapper.find('[data-testid="vigilance-overlay"]').exists()).toBe(false)
  })

  it('accumulates multiple flicker logs', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    // First flicker — responded
    ;(wrapper.vm as any).showFlicker()
    await nextTick()
    vi.stubGlobal('performance', { now: vi.fn(() => 1100) })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await nextTick()

    // Second flicker — missed
    vi.stubGlobal('performance', { now: vi.fn(() => 2000) })
    ;(wrapper.vm as any).showFlicker()
    await nextTick()
    vi.advanceTimersByTime(3_100)
    await nextTick()

    const logs = (wrapper.vm as any).flickerLogs
    expect(logs).toHaveLength(2)
    expect(logs[0].responded).toBe(true)
    expect(logs[1].responded).toBe(false)
  })

  it('has accessible aria-label during flicker', async () => {
    const wrapper = await mountSuspended(VigilanceTask)
    ;(wrapper.vm as any).start()
    await nextTick()

    const overlay = wrapper.find('[data-testid="vigilance-overlay"]')
    // No aria-label when not flickering
    expect(overlay.attributes('aria-label')).toBeUndefined()

    ;(wrapper.vm as any).showFlicker()
    await nextTick()

    expect(overlay.attributes('aria-label')).toBe('Attention check — press spacebar')
  })
})
