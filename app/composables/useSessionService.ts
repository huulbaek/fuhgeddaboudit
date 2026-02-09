export function useSessionService() {
  const { isGuest } = useAuth()

  async function create(body: { module: string; suds?: { rating: number; phase: string } }) {
    if (isGuest.value) {
      const store = useGuestStore()
      const session = store.createSession(body.module)
      if (body.suds) {
        store.addSudsRating(session.id, body.suds.rating, body.suds.phase)
      }
      return session
    }
    return await $fetch('/api/sessions', { method: 'POST', body })
  }

  async function update(id: string, body: {
    completed?: boolean
    aborted?: boolean
    abortReason?: string
    suds?: { rating: number; phase: string }
  }) {
    if (isGuest.value) {
      const store = useGuestStore()
      if (body.suds) {
        store.addSudsRating(id, body.suds.rating, body.suds.phase)
      }
      if (body.completed !== undefined || body.aborted !== undefined) {
        store.updateSession(id, {
          completed: body.completed,
          aborted: body.aborted,
          abortReason: body.abortReason,
        })
      }
      return store.getSession(id)
    }
    return await $fetch(`/api/sessions/${id}`, { method: 'PATCH', body })
  }

  async function get(id: string) {
    if (isGuest.value) {
      return useGuestStore().getSession(id)
    }
    return await $fetch(`/api/sessions/${id}`)
  }

  async function saveTntData(id: string, body: {
    totalTrials: number
    thinkTrials: number
    noThinkTrials: number
    compliancePct: number | null
    avgReactionTimeMs: number | null
  }) {
    if (isGuest.value) {
      useGuestStore().saveTntData(id, {
        totalTrials: body.totalTrials,
        thinkTrials: body.thinkTrials,
        noThinkTrials: body.noThinkTrials,
        gazeCompliancePct: body.compliancePct,
        avgReactionTimeMs: body.avgReactionTimeMs,
      })
      return { ok: true }
    }
    return await $fetch(`/api/sessions/${id}/tnt-data`, { method: 'POST', body })
  }

  return { create, update, get, saveTntData }
}
