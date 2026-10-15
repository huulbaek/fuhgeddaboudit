/**
 * Reconsolidation window clock.
 *
 * After a memory is reactivated the trace is labile for roughly 4–6 hours.
 * This composable tracks the most recent reactivation so the UI can show how
 * much of that window remains, and whether interference work has already
 * happened inside it. The anchor is wall-clock time (it must survive reloads
 * and sleep); the once-per-second display tick is driven by the rAF-based
 * precision timer and only runs while a window is open.
 *
 * Only a single small record is stored, in localStorage. Nothing reaches the server.
 */
import { usePrecisionTimer } from './usePrecisionTimer'

export const WINDOW_MS = 6 * 60 * 60 * 1000
export const CLOSING_AFTER_MS = 4 * 60 * 60 * 1000
export const STORAGE_KEY = 'reconsolidation-window'

export type WindowPhase = 'closed' | 'open' | 'closing' | 'expired'
/** What happened to the session that opened (or ran inside) the window. */
export type WindowOutcome = 'none' | 'completed' | 'aborted'

interface StoredWindow {
  openedAt: number
  outcome: WindowOutcome
}

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

const OUTCOMES: WindowOutcome[] = ['none', 'completed', 'aborted']

function readStored(): StoredWindow | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<StoredWindow>
    if (typeof parsed.openedAt !== 'number' || !Number.isFinite(parsed.openedAt)) return null
    const outcome = OUTCOMES.includes(parsed.outcome as WindowOutcome) ? parsed.outcome! : 'none'
    return { openedAt: parsed.openedAt, outcome }
  } catch {
    return null
  }
}

function writeStored(record: StoredWindow | null) {
  try {
    if (record === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Storage unavailable — the window still works for this page load
  }
}

// One rAF-driven ticker shared by every active subscriber (widget, header badge).
let activeSubscribers = 0
let ticker: ReturnType<typeof usePrecisionTimer> | null = null

export interface ReconsolidationWindowDeps {
  now?: () => number
}

export function useReconsolidationWindow(deps: ReconsolidationWindowDeps = {}) {
  const now = deps.now ?? (() => Date.now())

  const openedAt = useState<number | null>('reconsolidation-window-opened-at', () => null)
  const outcome = useState<WindowOutcome>('reconsolidation-window-outcome', () => 'none')
  const nowMs = useState<number>('reconsolidation-window-now', () => now())

  const phase = computed<WindowPhase>(() => windowPhase(openedAt.value, nowMs.value))
  const isOpen = computed(() => phase.value === 'open' || phase.value === 'closing')
  const remainingMs = computed(() => {
    if (openedAt.value === null) return 0
    return Math.max(0, openedAt.value + WINDOW_MS - nowMs.value)
  })

  function persist() {
    writeStored(openedAt.value === null ? null : { openedAt: openedAt.value, outcome: outcome.value })
  }

  /** Re-evaluate the clock against the current time. */
  function tick() {
    nowMs.value = now()
  }

  /** Anchor a new window at the current time (a reactivation just happened). */
  function open() {
    const t = now()
    openedAt.value = t
    outcome.value = 'none'
    nowMs.value = t
    persist()
  }

  /** Record how the session inside the current window ended. No-op without a window. */
  function markOutcome(result: Exclude<WindowOutcome, 'none'>) {
    if (openedAt.value === null) return
    outcome.value = result
    persist()
  }

  /** Forget the window entirely. */
  function clear() {
    openedAt.value = null
    outcome.value = 'none'
    nowMs.value = now()
    persist()
  }

  /**
   * Restore a window persisted by an earlier page load. The newer of the
   * stored and in-memory timestamps wins, so a browser that blocks storage
   * still keeps the window for the life of the page.
   */
  function load() {
    const stored = readStored()
    const current = openedAt.value
    if (stored !== null && (current === null || stored.openedAt > current)) {
      openedAt.value = stored.openedAt
      outcome.value = stored.outcome
    }
    nowMs.value = now()
  }

  function startTicker() {
    ticker = usePrecisionTimer()
    let lastSecond = -1
    ticker.onTick(() => {
      // Gate on wall-clock seconds so the digits never skip or stick
      const second = Math.floor(now() / 1000)
      if (second === lastSecond) return
      lastSecond = second
      tick()
    })
    ticker.start()
  }

  function stopTicker() {
    ticker?.stop()
    ticker = null
  }

  /**
   * Keep the clock ticking once per second while this subscriber is mounted
   * and a window is open. Returns a release function. The shared frame loop
   * runs only while at least one subscriber has an open window to show.
   */
  function subscribe(): () => void {
    let active = false
    const setActive = (next: boolean) => {
      if (next === active) return
      active = next
      activeSubscribers += next ? 1 : -1
      if (next && activeSubscribers === 1) startTicker()
      if (!next && activeSubscribers === 0) stopTicker()
    }
    const stopWatch = watch(isOpen, open => setActive(open), { immediate: true })
    let released = false
    return () => {
      if (released) return
      released = true
      stopWatch()
      setActive(false)
    }
  }

  return { openedAt, outcome, phase, isOpen, remainingMs, tick, open, markOutcome, clear, load, subscribe }
}
