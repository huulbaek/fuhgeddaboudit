import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'

interface SudsEntry {
  rating: number
  phase: string
  recordedAt: number
}

// Test the SUDs logic in isolation (without Nuxt useState / $fetch)
function createSuds(sessionId: string, mockFetch: typeof globalThis.$fetch) {
  const ratings = ref<SudsEntry[]>([])
  const currentRating = ref<number | null>(null)
  const submitting = ref(false)

  const latestRating = computed(() => {
    if (ratings.value.length === 0) return null
    return ratings.value[ratings.value.length - 1].rating
  })

  async function submitRating(rating: number, phase: string): Promise<void> {
    submitting.value = true
    try {
      await mockFetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        body: { suds: { rating, phase } },
      })
      currentRating.value = rating
      ratings.value = [...ratings.value, { rating, phase, recordedAt: Date.now() }]
    } finally {
      submitting.value = false
    }
  }

  function reset() {
    ratings.value = []
    currentRating.value = null
    submitting.value = false
  }

  return {
    ratings,
    currentRating,
    submitting,
    latestRating,
    submitRating,
    reset,
  }
}

describe('useSuds logic', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ updated: true })
  })

  it('starts with empty state', () => {
    const { ratings, currentRating, submitting, latestRating } = createSuds('s1', mockFetch as any)
    expect(ratings.value).toEqual([])
    expect(currentRating.value).toBeNull()
    expect(submitting.value).toBe(false)
    expect(latestRating.value).toBeNull()
  })

  it('submitRating posts to the correct session endpoint', async () => {
    const { submitRating } = createSuds('session-abc', mockFetch as any)
    await submitRating(5, 'pre')
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-abc', {
      method: 'PATCH',
      body: { suds: { rating: 5, phase: 'pre' } },
    })
  })

  it('submitRating updates currentRating and appends to ratings', async () => {
    const { submitRating, currentRating, ratings } = createSuds('s1', mockFetch as any)
    await submitRating(7, 'pre')
    expect(currentRating.value).toBe(7)
    expect(ratings.value).toHaveLength(1)
    expect(ratings.value[0].rating).toBe(7)
    expect(ratings.value[0].phase).toBe('pre')
  })

  it('latestRating reflects the most recent submission', async () => {
    const { submitRating, latestRating } = createSuds('s1', mockFetch as any)
    await submitRating(8, 'pre')
    expect(latestRating.value).toBe(8)
    await submitRating(3, 'post')
    expect(latestRating.value).toBe(3)
  })

  it('submitting is true during the fetch and false after', async () => {
    let resolvePromise: () => void
    mockFetch.mockReturnValue(new Promise<void>(r => { resolvePromise = r }))

    const { submitRating, submitting } = createSuds('s1', mockFetch as any)
    const promise = submitRating(5, 'mid')
    expect(submitting.value).toBe(true)

    resolvePromise!()
    await promise
    expect(submitting.value).toBe(false)
  })

  it('submitting resets to false even on fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { submitRating, submitting } = createSuds('s1', mockFetch as any)
    await expect(submitRating(5, 'pre')).rejects.toThrow('Network error')
    expect(submitting.value).toBe(false)
  })

  it('does not update state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('fail'))

    const { submitRating, currentRating, ratings } = createSuds('s1', mockFetch as any)
    await expect(submitRating(5, 'pre')).rejects.toThrow()
    expect(currentRating.value).toBeNull()
    expect(ratings.value).toHaveLength(0)
  })

  it('reset clears all state', async () => {
    const { submitRating, currentRating, ratings, submitting, reset } = createSuds('s1', mockFetch as any)
    await submitRating(6, 'pre')
    await submitRating(4, 'post')
    expect(ratings.value).toHaveLength(2)

    reset()
    expect(ratings.value).toEqual([])
    expect(currentRating.value).toBeNull()
    expect(submitting.value).toBe(false)
  })

  it('tracks multiple ratings with different phases', async () => {
    const { submitRating, ratings } = createSuds('s1', mockFetch as any)
    await submitRating(8, 'pre')
    await submitRating(5, 'mid_loop_1')
    await submitRating(3, 'mid_loop_2')
    await submitRating(2, 'post')

    expect(ratings.value).toHaveLength(4)
    expect(ratings.value.map(r => r.phase)).toEqual(['pre', 'mid_loop_1', 'mid_loop_2', 'post'])
    expect(ratings.value.map(r => r.rating)).toEqual([8, 5, 3, 2])
  })

  it('each entry has a recordedAt timestamp', async () => {
    vi.useFakeTimers()
    const { submitRating, ratings } = createSuds('s1', mockFetch as any)

    await submitRating(5, 'pre')
    const first = ratings.value[0].recordedAt

    vi.advanceTimersByTime(1000)
    await submitRating(3, 'post')
    const second = ratings.value[1].recordedAt

    expect(second).toBeGreaterThan(first)
    vi.useRealTimers()
  })
})
