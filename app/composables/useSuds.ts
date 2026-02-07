interface SudsEntry {
  rating: number
  phase: string
  recordedAt: number
}

export function useSuds(sessionId: string) {
  const ratings = useState<SudsEntry[]>(`suds-ratings-${sessionId}`, () => [])
  const currentRating = useState<number | null>(`suds-current-${sessionId}`, () => null)
  const submitting = useState<boolean>(`suds-submitting-${sessionId}`, () => false)

  const latestRating = computed(() => {
    if (ratings.value.length === 0) return null
    return ratings.value[ratings.value.length - 1].rating
  })

  async function submitRating(rating: number, phase: string): Promise<void> {
    submitting.value = true
    try {
      await $fetch(`/api/sessions/${sessionId}`, {
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
