const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export function useInactivityGrounding() {
  const { trigger, isGrounding } = useGrounding()

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let listening = false

  function resetTimer() {
    if (isGrounding.value) return // Don't reset while grounding is active
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      if (!isGrounding.value) {
        trigger('inactivity-auto-trigger')
      }
    }, INACTIVITY_TIMEOUT_MS)
  }

  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const

  function start() {
    if (listening) return
    listening = true
    for (const event of activityEvents) {
      document.addEventListener(event, resetTimer, { passive: true })
    }
    resetTimer()
  }

  function stop() {
    if (!listening) return
    listening = false
    for (const event of activityEvents) {
      document.removeEventListener(event, resetTimer)
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return { start, stop }
}
