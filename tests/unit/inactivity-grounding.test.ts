import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Replicate the logic in isolation (same pattern as grounding.test.ts)
function createInactivityGrounding(triggerFn: (ctx: string) => void, isGrounding: { value: boolean }) {
  const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let listening = false

  function resetTimer() {
    if (isGrounding.value) return
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      if (!isGrounding.value) {
        triggerFn('inactivity-auto-trigger')
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

  return { start, stop, resetTimer }
}

describe('useInactivityGrounding', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers grounding after 5 minutes of inactivity', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(false)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()
    expect(triggerFn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(triggerFn).toHaveBeenCalledWith('inactivity-auto-trigger')

    stop()
  })

  it('does not trigger before 5 minutes', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(false)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()
    vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000) // 4:59
    expect(triggerFn).not.toHaveBeenCalled()

    stop()
  })

  it('resets timer on user activity (keydown)', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(false)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()

    // Wait 4 minutes then simulate activity
    vi.advanceTimersByTime(4 * 60 * 1000)
    document.dispatchEvent(new Event('keydown'))

    // After another 4 minutes (total 8 from start, 4 from last activity), should NOT trigger
    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(triggerFn).not.toHaveBeenCalled()

    // After 5 minutes from last activity, SHOULD trigger
    vi.advanceTimersByTime(1 * 60 * 1000)
    expect(triggerFn).toHaveBeenCalledWith('inactivity-auto-trigger')

    stop()
  })

  it('resets timer on mouse activity', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(false)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()

    vi.advanceTimersByTime(4 * 60 * 1000)
    document.dispatchEvent(new Event('mousemove'))

    vi.advanceTimersByTime(4 * 60 * 1000)
    expect(triggerFn).not.toHaveBeenCalled()

    stop()
  })

  it('does not trigger if grounding is already active', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(true)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(triggerFn).not.toHaveBeenCalled()

    stop()
  })

  it('stop() prevents future triggers', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(false)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()
    vi.advanceTimersByTime(2 * 60 * 1000)
    stop()

    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(triggerFn).not.toHaveBeenCalled()
  })

  it('start() is idempotent — calling twice does not double listeners', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(false)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()
    start() // second call should be a no-op

    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(triggerFn).toHaveBeenCalledTimes(1)

    stop()
  })

  it('removes event listeners on stop()', () => {
    const triggerFn = vi.fn()
    const isGrounding = ref(false)
    const { start, stop } = createInactivityGrounding(triggerFn, isGrounding)

    start()
    stop()

    // Activity after stop should not start a new timer
    document.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(triggerFn).not.toHaveBeenCalled()
  })
})
