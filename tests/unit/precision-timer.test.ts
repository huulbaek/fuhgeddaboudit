import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { usePrecisionTimer } from '../../app/composables/usePrecisionTimer'

describe('usePrecisionTimer', () => {
  let rafCallbacks: Array<(time: number) => void> = []
  let rafIdCounter = 1
  let mockNow = 0

  beforeEach(() => {
    rafCallbacks = []
    rafIdCounter = 1
    mockNow = 0

    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)

    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      const id = rafIdCounter++
      rafCallbacks.push(cb as (time: number) => void)
      return id
    })

    globalThis.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushRAF(advanceMs: number) {
    mockNow += advanceMs
    const cbs = [...rafCallbacks]
    rafCallbacks = []
    for (const cb of cbs) {
      cb(mockNow)
    }
  }

  describe('start / stop / isRunning', () => {
    it('starts the timer and sets running state', () => {
      const timer = usePrecisionTimer()
      expect(timer.isRunning()).toBe(false)

      timer.start()
      expect(timer.isRunning()).toBe(true)
      expect(requestAnimationFrame).toHaveBeenCalled()

      timer.stop()
    })

    it('stops the timer and cancels animation frame', () => {
      const timer = usePrecisionTimer()
      timer.start()
      timer.stop()

      expect(timer.isRunning()).toBe(false)
      expect(cancelAnimationFrame).toHaveBeenCalled()
    })

    it('does not double-start if already running', () => {
      const timer = usePrecisionTimer()
      timer.start()
      timer.start()

      expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
      timer.stop()
    })

    it('does nothing if stop is called when not running', () => {
      const timer = usePrecisionTimer()
      timer.stop()
      expect(cancelAnimationFrame).not.toHaveBeenCalled()
    })
  })

  describe('elapsed', () => {
    it('returns 0 when not running', () => {
      const timer = usePrecisionTimer()
      expect(timer.elapsed()).toBe(0)
    })

    it('returns elapsed time based on performance.now()', () => {
      mockNow = 1000
      const timer = usePrecisionTimer()
      timer.start()

      mockNow = 1500
      expect(timer.elapsed()).toBe(500)

      mockNow = 2000
      expect(timer.elapsed()).toBe(1000)

      timer.stop()
    })
  })

  describe('onTick', () => {
    it('calls tick callback on each animation frame with elapsed time', () => {
      const timer = usePrecisionTimer()
      const tickFn = vi.fn()
      timer.onTick(tickFn)

      mockNow = 0
      timer.start()

      flushRAF(16)
      expect(tickFn).toHaveBeenCalledWith(16)

      flushRAF(16)
      expect(tickFn).toHaveBeenCalledWith(32)

      timer.stop()
    })

    it('supports multiple tick callbacks', () => {
      const timer = usePrecisionTimer()
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      timer.onTick(cb1)
      timer.onTick(cb2)

      mockNow = 0
      timer.start()
      flushRAF(16)

      expect(cb1).toHaveBeenCalledWith(16)
      expect(cb2).toHaveBeenCalledWith(16)

      timer.stop()
    })

    it('returns an unsubscribe function', () => {
      const timer = usePrecisionTimer()
      const cb = vi.fn()
      const unsub = timer.onTick(cb)

      mockNow = 0
      timer.start()
      flushRAF(16)
      expect(cb).toHaveBeenCalledTimes(1)

      unsub()
      flushRAF(16)
      expect(cb).toHaveBeenCalledTimes(1)

      timer.stop()
    })
  })

  describe('scheduleAt', () => {
    it('fires callback when elapsed time reaches the scheduled timestamp', () => {
      const timer = usePrecisionTimer()
      const scheduledFn = vi.fn()
      timer.scheduleAt(100, scheduledFn)

      mockNow = 0
      timer.start()

      // Before the scheduled time
      flushRAF(50)
      expect(scheduledFn).not.toHaveBeenCalled()

      // At/after the scheduled time
      flushRAF(60)
      expect(scheduledFn).toHaveBeenCalledTimes(1)

      timer.stop()
    })

    it('fires callback only once', () => {
      const timer = usePrecisionTimer()
      const scheduledFn = vi.fn()
      timer.scheduleAt(100, scheduledFn)

      mockNow = 0
      timer.start()

      flushRAF(150)
      expect(scheduledFn).toHaveBeenCalledTimes(1)

      flushRAF(50)
      expect(scheduledFn).toHaveBeenCalledTimes(1)

      timer.stop()
    })

    it('supports multiple scheduled events', () => {
      const timer = usePrecisionTimer()
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      const cb3 = vi.fn()
      timer.scheduleAt(100, cb1)
      timer.scheduleAt(200, cb2)
      timer.scheduleAt(300, cb3)

      mockNow = 0
      timer.start()

      flushRAF(150)
      expect(cb1).toHaveBeenCalledTimes(1)
      expect(cb2).not.toHaveBeenCalled()
      expect(cb3).not.toHaveBeenCalled()

      flushRAF(100)
      expect(cb2).toHaveBeenCalledTimes(1)
      expect(cb3).not.toHaveBeenCalled()

      flushRAF(100)
      expect(cb3).toHaveBeenCalledTimes(1)

      timer.stop()
    })

    it('resets scheduled events on restart', () => {
      const timer = usePrecisionTimer()
      const scheduledFn = vi.fn()
      timer.scheduleAt(100, scheduledFn)

      mockNow = 0
      timer.start()
      flushRAF(150)
      expect(scheduledFn).toHaveBeenCalledTimes(1)
      timer.stop()

      // Restart — scheduled event should fire again
      timer.start()
      flushRAF(150)
      expect(scheduledFn).toHaveBeenCalledTimes(2)
      timer.stop()
    })
  })

  describe('timing accuracy', () => {
    it('uses performance.now() for timing, not Date.now()', () => {
      const timer = usePrecisionTimer()
      mockNow = 5000
      timer.start()

      mockNow = 5016.67
      expect(timer.elapsed()).toBeCloseTo(16.67, 1)

      timer.stop()
    })

    it('measures sub-millisecond elapsed time', () => {
      const timer = usePrecisionTimer()
      mockNow = 0
      timer.start()

      mockNow = 0.5
      expect(timer.elapsed()).toBe(0.5)

      timer.stop()
    })

    it('scheduleAt fires on the first frame at or after the target time', () => {
      const timer = usePrecisionTimer()
      const scheduledFn = vi.fn()
      // Schedule at exactly 100ms
      timer.scheduleAt(100, scheduledFn)

      mockNow = 0
      timer.start()

      // Frame at 99ms — should not fire
      flushRAF(99)
      expect(scheduledFn).not.toHaveBeenCalled()

      // Frame at 100ms — should fire
      flushRAF(1)
      expect(scheduledFn).toHaveBeenCalledTimes(1)

      timer.stop()
    })
  })
})
