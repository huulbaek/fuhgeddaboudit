/**
 * Reconsolidation window clock.
 *
 * After a memory is reactivated the trace is labile for roughly 4–6 hours.
 * This composable tracks the most recent reactivation so the UI can show how
 * much of that window remains. The anchor is wall-clock time (it must survive
 * reloads and sleep); the display tick that calls `tick()` is driven by the
 * rAF-based precision timer in the component.
 *
 * Only a single timestamp is stored, in localStorage. Nothing reaches the server.
 */

export const WINDOW_MS = 6 * 60 * 60 * 1000
export const CLOSING_AFTER_MS = 4 * 60 * 60 * 1000
export const STORAGE_KEY = 'reconsolidation-window-opened-at'

export type WindowPhase = 'closed' | 'open' | 'closing' | 'expired'

export function windowPhase(openedAt: number | null, now: number): WindowPhase {
  if (openedAt === null) return 'closed'
  const elapsed = now - openedAt
  if (elapsed >= WINDOW_MS) return 'expired'
  if (elapsed >= CLOSING_AFTER_MS) return 'closing'
  return 'open'
}

function readStored(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function writeStored(openedAt: number | null) {
  try {
    if (openedAt === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, String(openedAt))
  } catch {
    // Storage unavailable — the window still works for this page load
  }
}

export interface ReconsolidationWindowDeps {
  now?: () => number
}

export function useReconsolidationWindow(deps: ReconsolidationWindowDeps = {}) {
  const now = deps.now ?? (() => Date.now())

  const openedAt = useState<number | null>('reconsolidation-window-opened-at', () => null)
  const nowMs = useState<number>('reconsolidation-window-now', () => now())

  const phase = computed<WindowPhase>(() => windowPhase(openedAt.value, nowMs.value))
  const remainingMs = computed(() => {
    if (openedAt.value === null) return 0
    return Math.max(0, openedAt.value + WINDOW_MS - nowMs.value)
  })

  /** Re-evaluate the clock against the current time. */
  function tick() {
    nowMs.value = now()
  }

  /** Anchor a new window at the current time (a reactivation just happened). */
  function open() {
    const t = now()
    openedAt.value = t
    nowMs.value = t
    writeStored(t)
  }

  /** Forget the window entirely. */
  function clear() {
    openedAt.value = null
    nowMs.value = now()
    writeStored(null)
  }

  /** Restore a window persisted by an earlier page load. */
  function load() {
    openedAt.value = readStored()
    nowMs.value = now()
  }

  return { openedAt, phase, remainingMs, tick, open, clear, load }
}
