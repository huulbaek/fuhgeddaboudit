export function useGrounding() {
  const isGrounding = useState<boolean>('grounding-active', () => false)
  const groundingStart = useState<number | null>('grounding-start', () => null)

  function trigger(context?: string) {
    isGrounding.value = true
    groundingStart.value = Date.now()

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
    groundingStart.value = null
    return durationSecs
  }

  return { isGrounding, trigger, dismiss }
}
