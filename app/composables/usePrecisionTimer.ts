type TickCallback = (elapsed: number) => void
type ScheduledCallback = () => void

interface ScheduledEvent {
  timestamp: number
  callback: ScheduledCallback
  fired: boolean
}

export function usePrecisionTimer() {
  let running = false
  let startTime = 0
  let rafId = 0
  const tickCallbacks: TickCallback[] = []
  const scheduledEvents: ScheduledEvent[] = []

  function tick() {
    if (!running) return
    const now = performance.now()
    const elapsedMs = now - startTime

    // Fire any scheduled events whose time has come
    for (const event of scheduledEvents) {
      if (!event.fired && elapsedMs >= event.timestamp) {
        event.fired = true
        event.callback()
      }
    }

    // Fire tick callbacks
    for (const cb of tickCallbacks) {
      cb(elapsedMs)
    }

    rafId = requestAnimationFrame(tick)
  }

  function start(): void {
    if (running) return
    running = true
    startTime = performance.now()
    // Reset scheduled events
    for (const event of scheduledEvents) {
      event.fired = false
    }
    rafId = requestAnimationFrame(tick)
  }

  function stop(): void {
    if (!running) return
    running = false
    cancelAnimationFrame(rafId)
  }

  function onTick(callback: TickCallback): () => void {
    tickCallbacks.push(callback)
    return () => {
      const idx = tickCallbacks.indexOf(callback)
      if (idx !== -1) tickCallbacks.splice(idx, 1)
    }
  }

  function scheduleAt(timestamp: number, callback: ScheduledCallback): void {
    scheduledEvents.push({ timestamp, callback, fired: false })
  }

  function elapsed(): number {
    if (!running) return 0
    return performance.now() - startTime
  }

  function isRunning(): boolean {
    return running
  }

  return {
    start,
    stop,
    onTick,
    scheduleAt,
    elapsed,
    isRunning,
  }
}
