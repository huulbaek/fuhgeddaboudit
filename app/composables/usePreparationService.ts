export function usePreparationService() {
  const { isGuest } = useAuth()

  async function complete() {
    if (isGuest.value) {
      useGuestStore().updateStatus({ preparationComplete: true })
      return { ok: true }
    }
    return await $fetch('/api/preparation/complete', { method: 'POST' })
  }

  return { complete }
}
