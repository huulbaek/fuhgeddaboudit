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
import { usePrecisionTimer } from './usePrecisionTimer'

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

/** Format a remaining duration as H:MM:SS. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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

// One rAF-driven ticker shared by every subscriber (widget, header badge).
let subscriberCount = 0
let ticker: ReturnType<typeof usePrecisionTimer> | null = null

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

  /**
   * Restore a window persisted by an earlier page load. The newer of the
   * stored and in-memory timestamps wins, so a browser that blocks storage
   * still keeps the window for the life of the page.
   */
  function load() {
    const stored = readStored()
    const current = openedAt.value
    if (stored !== null && (current === null || stored > current)) {
      openedAt.value = stored
    }
    nowMs.value = now()
  }

  /**
   * Keep the clock ticking once per second while at least one subscriber is
   * mounted. Returns a release function; the ticker stops with the last one.
   */
  function subscribe(): () => void {
    subscriberCount++
    if (subscriberCount === 1) {
      ticker = usePrecisionTimer()
      let lastSecond = -1
      ticker.onTick((elapsed) => {
        const second = Math.floor(elapsed / 1000)
        if (second === lastSecond) return
        lastSecond = second
        tick()
      })
      ticker.start()
    }
    let released = false
    return () => {
      if (released) return
      released = true
      subscriberCount--
      if (subscriberCount === 0) {
        ticker?.stop()
        ticker = null
      }
    }
  }

  return { openedAt, phase, remainingMs, tick, open, clear, load, subscribe }
}
