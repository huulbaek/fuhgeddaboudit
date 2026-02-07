import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScreeningPage from '../../app/pages/screening/index.vue'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('Screening Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders with PC-PTSD-5 as the first step', async () => {
    const wrapper = await mountSuspended(ScreeningPage)
    expect(wrapper.text()).toContain('Screening')
    expect(wrapper.text()).toContain('Step 1: PC-PTSD-5')
    expect(wrapper.text()).toContain('Step 2: DES-Brief')
    // PcPtsd5 component should be rendered
    expect(wrapper.findComponent({ name: 'ScreeningPcPtsd5' }).exists()).toBe(true)
    // DesBrief should NOT be rendered yet
    expect(wrapper.findComponent({ name: 'ScreeningDesBrief' }).exists()).toBe(false)
  })

  it('shows DesBrief after PcPtsd5 is completed', async () => {
    const wrapper = await mountSuspended(ScreeningPage)
    const pcptsd5 = wrapper.findComponent({ name: 'ScreeningPcPtsd5' })

    // Simulate PcPtsd5 completion
    pcptsd5.vm.$emit('complete', 3, [true, true, true, false, false])
    await wrapper.vm.$nextTick()

    // PcPtsd5 should be hidden
    expect(wrapper.findComponent({ name: 'ScreeningPcPtsd5' }).exists()).toBe(false)
    // DesBrief should now be visible
    expect(wrapper.findComponent({ name: 'ScreeningDesBrief' }).exists()).toBe(true)
  })

  it('submits results to server after DesBrief is completed', async () => {
    mockFetch.mockResolvedValue({})
    const wrapper = await mountSuspended(ScreeningPage)

    // Complete PcPtsd5
    const pcptsd5 = wrapper.findComponent({ name: 'ScreeningPcPtsd5' })
    pcptsd5.vm.$emit('complete', 3, [true, true, true, false, false])
    await wrapper.vm.$nextTick()

    // Complete DesBrief
    const desbrief = wrapper.findComponent({ name: 'ScreeningDesBrief' })
    desbrief.vm.$emit('complete', 25, [20, 30, 10, 40, 20, 30, 20, 30])
    await wrapper.vm.$nextTick()

    expect(mockFetch).toHaveBeenCalledWith('/api/screening/submit', {
      method: 'POST',
      body: {
        pcptsd5: { score: 3, answers: [true, true, true, false, false] },
        desbrief: { score: 25, answers: [20, 30, 10, 40, 20, 30, 20, 30] },
      },
    })
  })

  it('shows submitting state and calls fetch on successful completion', async () => {
    // Use a deferred promise so we can check the submitting state
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))
    const wrapper = await mountSuspended(ScreeningPage)

    // Complete PcPtsd5
    const pcptsd5 = wrapper.findComponent({ name: 'ScreeningPcPtsd5' })
    pcptsd5.vm.$emit('complete', 3, [true, true, true, false, false])
    await wrapper.vm.$nextTick()

    // Complete DesBrief
    const desbrief = wrapper.findComponent({ name: 'ScreeningDesBrief' })
    desbrief.vm.$emit('complete', 10, [10, 10, 10, 10, 10, 10, 10, 10])
    await wrapper.vm.$nextTick()

    // Should show submitting state while fetch is pending
    expect(wrapper.text()).toContain('Submitting your results')
    expect(mockFetch).toHaveBeenCalledOnce()

    // Resolve the fetch
    resolveFetch!({})
  })

  it('shows error message when submission fails', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(ScreeningPage)

    // Complete PcPtsd5
    const pcptsd5 = wrapper.findComponent({ name: 'ScreeningPcPtsd5' })
    pcptsd5.vm.$emit('complete', 3, [true, true, true, false, false])
    await wrapper.vm.$nextTick()

    // Complete DesBrief
    const desbrief = wrapper.findComponent({ name: 'ScreeningDesBrief' })
    desbrief.vm.$emit('complete', 10, [10, 10, 10, 10, 10, 10, 10, 10])
    await wrapper.vm.$nextTick()

    // Wait for error to appear
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })

    // Should go back to desbrief step on error
    expect(wrapper.findComponent({ name: 'ScreeningDesBrief' }).exists()).toBe(true)
  })
})
