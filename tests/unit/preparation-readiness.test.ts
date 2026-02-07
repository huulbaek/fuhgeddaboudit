import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReadinessPage from '../../app/pages/preparation/readiness.vue'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('Preparation Readiness Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders with the ReadinessTimer component', async () => {
    const wrapper = await mountSuspended(ReadinessPage)
    expect(wrapper.text()).toContain('Preparation')
    expect(wrapper.text()).toContain('Step 1: Safe Place')
    expect(wrapper.text()).toContain('Step 2: Readiness Check')
    expect(wrapper.findComponent({ name: 'PreparationReadinessTimer' }).exists()).toBe(true)
  })

  it('marks Step 2 as active and Step 1 as completed', async () => {
    const wrapper = await mountSuspended(ReadinessPage)
    const steps = wrapper.findAll('span')
    const step1 = steps.find(s => s.text().includes('Step 1'))
    const step2 = steps.find(s => s.text().includes('Step 2'))
    expect(step1?.classes()).toContain('text-green-600')
    expect(step2?.classes()).toContain('text-primary')
  })

  it('posts to server on readiness success', async () => {
    mockFetch.mockResolvedValue({ preparationComplete: true })
    const wrapper = await mountSuspended(ReadinessPage)

    const timer = wrapper.findComponent({ name: 'PreparationReadinessTimer' })
    timer.vm.$emit('success')
    await wrapper.vm.$nextTick()

    expect(mockFetch).toHaveBeenCalledWith('/api/preparation/complete', { method: 'POST' })
  })

  it('shows submitting state while posting', async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))
    const wrapper = await mountSuspended(ReadinessPage)

    const timer = wrapper.findComponent({ name: 'PreparationReadinessTimer' })
    timer.vm.$emit('success')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Saving your progress')
    expect(wrapper.findComponent({ name: 'PreparationReadinessTimer' }).exists()).toBe(false)

    resolveFetch!({ preparationComplete: true })
  })

  it('shows error message when submission fails', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(ReadinessPage)

    const timer = wrapper.findComponent({ name: 'PreparationReadinessTimer' })
    timer.vm.$emit('success')
    await wrapper.vm.$nextTick()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })

    // Should show the timer again after error
    expect(wrapper.findComponent({ name: 'PreparationReadinessTimer' }).exists()).toBe(true)
  })
})
