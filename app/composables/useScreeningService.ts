export function useScreeningService() {
  const { isGuest } = useAuth()

  async function submit(body: {
    pcptsd5: { score: number; answers: boolean[] }
    desbrief: { score: number; answers: number[] }
  }) {
    if (isGuest.value) {
      const store = useGuestStore()
      const { pcptsd5, desbrief } = body

      // Replicate server-side screening logic
      const desbriefResult = desbrief.score >= 20 ? 'excluded' : 'admitted'
      const pcptsd5Result = pcptsd5.score >= 3 ? 'admitted' : 'informational'
      const overallResult = desbriefResult === 'excluded' ? 'excluded' : pcptsd5Result

      const now = new Date().toISOString()
      store.addScreeningResult({ instrument: 'PC-PTSD-5', score: pcptsd5.score, result: pcptsd5Result, completedAt: now })
      store.addScreeningResult({ instrument: 'DES-Brief', score: desbrief.score, result: desbriefResult, completedAt: now })
      store.updateStatus({ screeningComplete: true })

      return {
        pcptsd5: { score: pcptsd5.score, result: pcptsd5Result },
        desbrief: { score: desbrief.score, result: desbriefResult },
        overallResult,
      }
    }
    return await $fetch('/api/screening/submit', { method: 'POST', body })
  }

  async function getStatus() {
    if (isGuest.value) {
      const store = useGuestStore()
      const status = store.getStatus()
      return {
        screeningComplete: status.screeningComplete,
        results: store.getScreeningResults(),
      }
    }
    return await $fetch('/api/screening/status')
  }

  return { submit, getStatus }
}
