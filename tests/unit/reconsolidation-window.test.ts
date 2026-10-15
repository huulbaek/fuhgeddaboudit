import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useReconsolidationWindow,
  windowPhase,
  WINDOW_MS,
  CLOSING_AFTER_MS,
  STORAGE_KEY,
} from '../../app/composables/useReconsolidationWindow'

const HOUR = 60 * 60 * 1000

const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((k: string) => storage.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { storage.set(k, v) }),
  removeItem: vi.fn((k: string) => { storage.delete(k) }),
  clear: vi.fn(() => storage.clear()),
}
vi.stubGlobal('localStorage', mockLocalStorage)

function makeClock(start = 1_000_000) {
  let t = start
  return {
    now: () => t,
    advance(ms: number) { t += ms },
  }
}

describe('windowPhase', () => {
  it('is closed when never opened', () => {
    expect(windowPhase(null, 50)).toBe('closed')
  })

  it('is open for the first four hours, closing until six, then expired', () => {
    expect(windowPhase(0, 0)).toBe('open')
    expect(windowPhase(0, CLOSING_AFTER_MS - 1)).toBe('open')
    expect(windowPhase(0, CLOSING_AFTER_MS)).toBe('closing')
    expect(windowPhase(0, WINDOW_MS - 1)).toBe('closing')
    expect(windowPhase(0, WINDOW_MS)).toBe('expired')
  })

  it('treats a timestamp from the future as open', () => {
    expect(windowPhase(1000, 0)).toBe('open')
  })
})

describe('useReconsolidationWindow', () => {
  beforeEach(() => {
    storage.clear()
    mockLocalStorage.getItem.mockImplementation((k: string) => storage.get(k) ?? null)
    mockLocalStorage.setItem.mockImplementation((k: string, v: string) => { storage.set(k, v) })
    mockLocalStorage.removeItem.mockImplementation((k: string) => { storage.delete(k) })
    useReconsolidationWindow().clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts closed with nothing remaining', () => {
    const clock = makeClock()
    const w = useReconsolidationWindow({ now: clock.now })
    expect(w.phase.value).toBe('closed')
    expect(w.remainingMs.value).toBe(0)
    expect(w.openedAt.value).toBeNull()
  })

  it('open() anchors the window to now and persists the timestamp', () => {
    const clock = makeClock(5_000)
    const w = useReconsolidationWindow({ now: clock.now })
    w.open()
    expect(w.phase.value).toBe('open')
    expect(w.openedAt.value).toBe(5_000)
    expect(w.remainingMs.value).toBe(WINDOW_MS)
    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toEqual({ openedAt: 5000, outcome: 'none' })
  })

  it('tick() advances through closing to expired', () => {
    const clock = makeClock()
    const w = useReconsolidationWindow({ now: clock.now })
    w.open()
    clock.advance(4 * HOUR)
    w.tick()
    expect(w.phase.value).toBe('closing')
    expect(w.remainingMs.value).toBe(2 * HOUR)
    clock.advance(2 * HOUR)
    w.tick()
    expect(w.phase.value).toBe('expired')
    expect(w.remainingMs.value).toBe(0)
  })

  it('opening again re-anchors to the latest reactivation', () => {
    const clock = makeClock()
    const w = useReconsolidationWindow({ now: clock.now })
    w.open()
    clock.advance(5 * HOUR)
    w.open()
    expect(w.phase.value).toBe('open')
    expect(w.remainingMs.value).toBe(WINDOW_MS)
  })

  it('load() restores a stored window and evaluates it against now', () => {
    const clock = makeClock(10 * HOUR)
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: 5 * HOUR, outcome: 'none' }))
    const w = useReconsolidationWindow({ now: clock.now })
    w.load()
    expect(w.phase.value).toBe('closing')
    expect(w.remainingMs.value).toBe(1 * HOUR)
  })

  it('load() keeps an in-memory window when storage has nothing newer', () => {
    const clock = makeClock()
    const w = useReconsolidationWindow({ now: clock.now })
    w.open()
    storage.clear()
    w.load()
    expect(w.phase.value).toBe('open')
    expect(w.remainingMs.value).toBe(WINDOW_MS)
  })

  it('load() prefers the newer of stored and in-memory timestamps', () => {
    const clock = makeClock(10 * HOUR)
    const w = useReconsolidationWindow({ now: clock.now })
    w.open()
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: 9 * HOUR, outcome: 'none' }))
    w.load()
    expect(w.openedAt.value).toBe(10 * HOUR)
  })

  it('load() treats corrupted storage as closed', () => {
    storage.set(STORAGE_KEY, 'not-a-number')
    const w = useReconsolidationWindow({ now: makeClock().now })
    w.load()
    expect(w.phase.value).toBe('closed')
  })

  it('still works in memory when localStorage throws', () => {
    mockLocalStorage.getItem.mockImplementation(() => { throw new Error('blocked') })
    mockLocalStorage.setItem.mockImplementation(() => { throw new Error('blocked') })
    const w = useReconsolidationWindow({ now: makeClock().now })
    w.load()
    expect(w.phase.value).toBe('closed')
    w.open()
    expect(w.phase.value).toBe('open')
  })

  it('clear() closes the window and removes the stored timestamp', () => {
    const w = useReconsolidationWindow({ now: makeClock().now })
    w.open()
    w.clear()
    expect(w.phase.value).toBe('closed')
    expect(storage.has(STORAGE_KEY)).toBe(false)
  })

  it('subscribe() ticks the clock until the last subscriber releases', async () => {
    const clock = makeClock()
    const w = useReconsolidationWindow({ now: clock.now })
    w.open()
    const releaseA = w.subscribe()
    const releaseB = w.subscribe()
    clock.advance(HOUR)
    await vi.waitFor(() => expect(w.remainingMs.value).toBe(WINDOW_MS - HOUR), { timeout: 3000 })
    releaseA()
    clock.advance(HOUR)
    await vi.waitFor(() => expect(w.remainingMs.value).toBe(WINDOW_MS - 2 * HOUR), { timeout: 3000 })
    releaseB()
    clock.advance(HOUR)
    await new Promise(r => setTimeout(r, 1200))
    expect(w.remainingMs.value).toBe(WINDOW_MS - 2 * HOUR)
  })

  it('records a session outcome inside the window and restores it', () => {
    const clock = makeClock()
    const w = useReconsolidationWindow({ now: clock.now })
    w.open()
    expect(w.outcome.value).toBe('none')
    w.markOutcome('completed')
    expect(w.outcome.value).toBe('completed')
    // Simulate a fresh page load: in-memory state gone, storage intact
    const saved = storage.get(STORAGE_KEY)!
    const fresh = useReconsolidationWindow({ now: clock.now })
    fresh.clear()
    storage.set(STORAGE_KEY, saved)
    fresh.load()
    expect(fresh.outcome.value).toBe('completed')
    expect(fresh.phase.value).toBe('open')
  })

  it('a new reactivation resets the outcome', () => {
    const w = useReconsolidationWindow({ now: makeClock().now })
    w.open()
    w.markOutcome('aborted')
    w.open()
    expect(w.outcome.value).toBe('none')
  })

  it('ignores an outcome when no window is open', () => {
    const w = useReconsolidationWindow({ now: makeClock().now })
    w.markOutcome('completed')
    expect(w.outcome.value).toBe('none')
    expect(w.phase.value).toBe('closed')
  })

  it('subscribe() only runs the frame loop while a window is open', async () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame')
    const clock = makeClock()
    const w = useReconsolidationWindow({ now: clock.now })
    const release = w.subscribe()
    await nextTick()
    expect(raf).not.toHaveBeenCalled()
    w.open()
    await nextTick()
    expect(raf).toHaveBeenCalled()
    release()
  })

  it('shares one window across instances', () => {
    const clock = makeClock()
    const a = useReconsolidationWindow({ now: clock.now })
    const b = useReconsolidationWindow({ now: clock.now })
    a.open()
    expect(b.phase.value).toBe('open')
  })
})
