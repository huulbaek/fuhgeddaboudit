import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Test the grounding logic in isolation (without Nuxt useState)
function createGrounding() {
  const isGrounding = ref(false)
  const groundingStart = ref<number | null>(null)

  function trigger() {
    isGrounding.value = true
    groundingStart.value = Date.now()
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

describe('useGrounding logic', () => {
  it('starts in non-grounding state', () => {
    const { isGrounding } = createGrounding()
    expect(isGrounding.value).toBe(false)
  })

  it('trigger() activates grounding', () => {
    const { isGrounding, trigger } = createGrounding()
    trigger()
    expect(isGrounding.value).toBe(true)
  })

  it('dismiss() deactivates grounding', () => {
    const { isGrounding, trigger, dismiss } = createGrounding()
    trigger()
    dismiss()
    expect(isGrounding.value).toBe(false)
  })

  it('dismiss() returns duration in seconds', async () => {
    vi.useFakeTimers()
    const { trigger, dismiss } = createGrounding()
    trigger()
    vi.advanceTimersByTime(5000) // 5 seconds
    const duration = dismiss()
    expect(duration).toBe(5)
    vi.useRealTimers()
  })

  it('dismiss() returns 0 if never triggered', () => {
    const { dismiss } = createGrounding()
    expect(dismiss()).toBe(0)
  })
})
