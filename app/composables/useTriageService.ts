export function useTriageService() {
  const { isGuest } = useAuth()

  async function submit(body: {
    answers: { id: string; rating: number }[]
    recommendation: string
    selectedModule: string
  }) {
    if (isGuest.value) {
      const store = useGuestStore()
      store.updateStatus({
        activeModule: body.selectedModule,
        lastTriageResult: body.recommendation,
      })
      return {
        recommendation: body.recommendation,
        selectedModule: body.selectedModule,
      }
    }
    return await $fetch('/api/triage/recommend', { method: 'POST', body })
  }

  return { submit }
}
