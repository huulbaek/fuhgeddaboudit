export function useGrounding() {
  const isGrounding = useState<boolean>('grounding-active', () => false)
  const groundingStart = useState<number | null>('grounding-start', () => null)

  function trigger(context?: string) {
    isGrounding.value = true
    groundingStart.value = Date.now()

    const { isGuest } = useAuth()
    if (isGuest.value) {
      // Guest mode: store locally (duration will be recorded on dismiss)
      return
    }

    $fetch('/api/grounding/log', {
      method: 'POST',
      body: { context: context || 'unknown' },
    }).catch(() => {
      // Grounding must work even if logging fails
    })
  }

  function dismiss() {
    const durationSecs = groundingStart.value
      ? Math.round((Date.now() - groundingStart.value) / 1000)
      : 0
    isGrounding.value = false

    const { isGuest } = useAuth()
    if (isGuest.value) {
      useGuestStore().addGroundingEvent({
        triggeredAt: groundingStart.value
          ? new Date(groundingStart.value).toISOString()
          : new Date().toISOString(),
        durationSecs,
        context: 'grounding-overlay',
      })
    }

    groundingStart.value = null
    return durationSecs
  }

  return { isGrounding, trigger, dismiss }
}
