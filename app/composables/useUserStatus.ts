export function useUserStatus() {
  const { isGuest } = useAuth()

  async function getStatus() {
    if (isGuest.value) {
      const store = useGuestStore()
      const status = store.getStatus()
      const config = useRuntimeConfig()
      const screeningEnabled = config.public.screeningEnabled
      return {
        screeningComplete: screeningEnabled ? status.screeningComplete : true,
        preparationComplete: status.preparationComplete,
        activeModule: status.activeModule,
        lastTriageResult: status.lastTriageResult,
        recentSessions: store.getRecentSessions(),
      }
    }
    return await $fetch('/api/user/status')
  }

  return { getStatus }
}
