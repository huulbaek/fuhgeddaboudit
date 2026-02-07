import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScreeningResults from '../../app/pages/screening/results.vue'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

function makeResults(pcptsd5Score: number, pcptsd5Result: string, desbriefScore: number, desbriefResult: string) {
  return {
    screeningComplete: true,
    results: [
      { instrument: 'PC-PTSD-5', score: pcptsd5Score, result: pcptsd5Result, completedAt: '2025-01-01T00:00:00Z' },
      { instrument: 'DES-Brief', score: desbriefScore, result: desbriefResult, completedAt: '2025-01-01T00:00:00Z' },
    ],
  }
}

describe('Screening Results Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('shows no outcome when screening is not complete', async () => {
    mockFetch.mockResolvedValue({ screeningComplete: false, results: [] })
    const wrapper = await mountSuspended(ScreeningResults)

    // Wait for async mount to settle
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="outcome-excluded"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="outcome-admitted"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="outcome-informational"]').exists()).toBe(false)
    })
  })

  it('shows excluded outcome when DES-Brief result is excluded', async () => {
    mockFetch.mockResolvedValue(makeResults(4, 'admitted', 25, 'excluded'))
    const wrapper = await mountSuspended(ScreeningResults)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="outcome-excluded"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('This program may not be right for you at this time')
    expect(wrapper.text()).toContain('988')
    expect(wrapper.text()).toContain('741741')
    expect(wrapper.find('[data-testid="outcome-admitted"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="outcome-informational"]').exists()).toBe(false)
  })

  it('shows admitted outcome when PC-PTSD-5 is admitted and DES-Brief is not excluded', async () => {
    mockFetch.mockResolvedValue(makeResults(3, 'admitted', 10, 'admitted'))
    const wrapper = await mountSuspended(ScreeningResults)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="outcome-admitted"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('ready to proceed')
    expect(wrapper.text()).toContain('Continue to Preparation')
    expect(wrapper.find('[data-testid="outcome-excluded"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="outcome-informational"]').exists()).toBe(false)
  })

  it('shows informational outcome when both scores are below threshold', async () => {
    mockFetch.mockResolvedValue(makeResults(1, 'informational', 8, 'admitted'))
    const wrapper = await mountSuspended(ScreeningResults)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="outcome-informational"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('below the clinical threshold')
    expect(wrapper.text()).toContain('mental health professional')
    expect(wrapper.find('[data-testid="outcome-excluded"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="outcome-admitted"]').exists()).toBe(false)
  })

  it('shows excluded outcome even when PC-PTSD-5 is admitted (DES-Brief takes priority)', async () => {
    mockFetch.mockResolvedValue(makeResults(5, 'admitted', 30, 'excluded'))
    const wrapper = await mountSuspended(ScreeningResults)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="outcome-excluded"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="outcome-admitted"]').exists()).toBe(false)
  })

  it('shows loading state initially', async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))

    const wrapper = await mountSuspended(ScreeningResults)
    expect(wrapper.text()).toContain('Loading your results')

    resolveFetch!(makeResults(3, 'admitted', 10, 'admitted'))
  })

  it('shows error message when API call fails', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Unauthorized' } })
    const wrapper = await mountSuspended(ScreeningResults)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Unauthorized')
    })
  })
})
