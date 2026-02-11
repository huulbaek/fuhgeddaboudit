import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useEyeTracking,
  _resetEyeTracking,
  type WebGazerInstance,
  type GazeData,
} from '../../app/composables/useEyeTracking'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockWebGazer(
  getPrediction: () => Promise<GazeData | null> = () => Promise.resolve({ x: 100, y: 100 }),
): WebGazerInstance {
  return {
    begin: vi.fn().mockResolvedValue(undefined),
    end: vi.fn(),
    getCurrentPrediction: vi.fn(getPrediction),
    showVideoPreview: vi.fn().mockReturnThis(),
    showPredictionPoints: vi.fn().mockReturnThis(),
    showFaceOverlay: vi.fn().mockReturnThis(),
    showFaceFeedbackBox: vi.fn().mockReturnThis(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEyeTracking', () => {
  let now: number

  beforeEach(() => {
    _resetEyeTracking()
    now = 1000
    vi.stubGlobal('performance', { now: vi.fn(() => now) })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  it('starts in uninitialized state', () => {
    const mockWg = createMockWebGazer()
    const { state } = useEyeTracking({ webgazer: mockWg })

    expect(state.value.initialized).toBe(false)
    expect(state.value.monitoring).toBe(false)
    expect(state.value.paused).toBe(false)
    expect(state.value.pauseMessage).toBeNull()
  })

  it('initializes WebGazer and hides UI overlays', async () => {
    const mockWg = createMockWebGazer()
    const { state, initialize } = useEyeTracking({ webgazer: mockWg })

    await initialize()

    // begin() must be called before hiding overlays so video has real dimensions
    expect(mockWg.begin).toHaveBeenCalledOnce()
    // Non-video overlays hidden via WebGazer API
    expect(mockWg.showPredictionPoints).toHaveBeenCalledWith(false)
    expect(mockWg.showFaceOverlay).toHaveBeenCalledWith(false)
    expect(mockWg.showFaceFeedbackBox).toHaveBeenCalledWith(false)
    // Video preview hidden via CSS (not showVideoPreview which uses display:none)
    expect(mockWg.showVideoPreview).not.toHaveBeenCalled()
    expect(state.value.initialized).toBe(true)
  })

  it('does not re-initialize if already initialized', async () => {
    const mockWg = createMockWebGazer()
    const { initialize } = useEyeTracking({ webgazer: mockWg })

    await initialize()
    await initialize()

    expect(mockWg.begin).toHaveBeenCalledOnce()
  })

  // -----------------------------------------------------------------------
  // Monitoring lifecycle
  // -----------------------------------------------------------------------

  it('does not start monitoring before initialization', async () => {
    const mockWg = createMockWebGazer()
    const { state, startMonitoring } = useEyeTracking({ webgazer: mockWg })

    startMonitoring()

    expect(state.value.monitoring).toBe(false)
  })

  it('starts monitoring after initialization', async () => {
    const mockWg = createMockWebGazer()
    const { state, initialize, startMonitoring } = useEyeTracking({ webgazer: mockWg })

    await initialize()
    startMonitoring()

    expect(state.value.monitoring).toBe(true)
    expect(state.value.paused).toBe(false)
  })

  it('stops monitoring and clears state', async () => {
    const mockWg = createMockWebGazer()
    const { state, initialize, startMonitoring, stopMonitoring } = useEyeTracking({
      webgazer: mockWg,
    })

    await initialize()
    startMonitoring()
    stopMonitoring()

    expect(state.value.monitoring).toBe(false)
    expect(state.value.paused).toBe(false)
    expect(state.value.pauseMessage).toBeNull()
  })

  it('does not double-start monitoring', async () => {
    const mockWg = createMockWebGazer()
    const { initialize, startMonitoring } = useEyeTracking({
      webgazer: mockWg,
      checkIntervalMs: 100,
    })

    await initialize()
    startMonitoring()
    startMonitoring()

    // Advance one interval — should only call getCurrentPrediction once
    await vi.advanceTimersByTimeAsync(100)
    expect(mockWg.getCurrentPrediction).toHaveBeenCalledTimes(1)
  })

  // -----------------------------------------------------------------------
  // Gaze detection — happy path
  // -----------------------------------------------------------------------

  it('does not pause when gaze is consistently detected', async () => {
    const mockWg = createMockWebGazer(() => Promise.resolve({ x: 200, y: 300 }))
    const { state, initialize, startMonitoring } = useEyeTracking({
      webgazer: mockWg,
      checkIntervalMs: 100,
      gazeLostThresholdMs: 200,
    })

    await initialize()
    startMonitoring()

    // Advance through several checks
    now = 1100
    await vi.advanceTimersByTimeAsync(100)
    now = 1200
    await vi.advanceTimersByTimeAsync(100)
    now = 1300
    await vi.advanceTimersByTimeAsync(100)

    expect(state.value.paused).toBe(false)
    expect(state.value.pauseMessage).toBeNull()
  })

  // -----------------------------------------------------------------------
  // Gaze lost — pausing
  // -----------------------------------------------------------------------

  it('pauses when gaze is lost for longer than threshold', async () => {
    let gazePresent = true
    const mockWg = createMockWebGazer(() =>
      Promise.resolve(gazePresent ? { x: 100, y: 100 } : null),
    )
    const { state, initialize, startMonitoring } = useEyeTracking({
      webgazer: mockWg,
      checkIntervalMs: 100,
      gazeLostThresholdMs: 200,
    })

    await initialize()
    startMonitoring()

    // First check — gaze present
    now = 1100
    await vi.advanceTimersByTimeAsync(100)
    expect(state.value.paused).toBe(false)

    // Gaze disappears
    gazePresent = false

    // Second check — gaze lost for 100ms (under threshold)
    now = 1200
    await vi.advanceTimersByTimeAsync(100)
    expect(state.value.paused).toBe(false)

    // Third check — gaze lost for 200ms+ (exceeds threshold)
    now = 1400
    await vi.advanceTimersByTimeAsync(200)
    expect(state.value.paused).toBe(true)
    expect(state.value.pauseMessage).toBe('Please look at the screen')
  })

  it('unpauses when gaze is recovered', async () => {
    let gazePresent = true
    const mockWg = createMockWebGazer(() =>
      Promise.resolve(gazePresent ? { x: 100, y: 100 } : null),
    )
    const { state, initialize, startMonitoring } = useEyeTracking({
      webgazer: mockWg,
      checkIntervalMs: 100,
      gazeLostThresholdMs: 200,
    })

    await initialize()
    startMonitoring()

    // First check — gaze present
    now = 1100
    await vi.advanceTimersByTimeAsync(100)

    // Gaze lost → pause
    gazePresent = false
    now = 1400
    await vi.advanceTimersByTimeAsync(300)
    expect(state.value.paused).toBe(true)

    // Gaze recovered → unpause
    gazePresent = true
    now = 1500
    await vi.advanceTimersByTimeAsync(100)
    expect(state.value.paused).toBe(false)
    expect(state.value.pauseMessage).toBeNull()
  })

  // -----------------------------------------------------------------------
  // Destroy
  // -----------------------------------------------------------------------

  it('destroy tears down WebGazer and resets state', async () => {
    const mockWg = createMockWebGazer()
    const { state, initialize, startMonitoring, destroy } = useEyeTracking({
      webgazer: mockWg,
    })

    await initialize()
    startMonitoring()
    destroy()

    expect(mockWg.end).toHaveBeenCalledOnce()
    expect(state.value.initialized).toBe(false)
    expect(state.value.monitoring).toBe(false)
    expect(state.value.paused).toBe(false)
  })

  it('destroy is safe to call when not initialized', () => {
    const mockWg = createMockWebGazer()
    const { destroy } = useEyeTracking({ webgazer: mockWg })

    // Should not throw
    expect(() => destroy()).not.toThrow()
  })

  // -----------------------------------------------------------------------
  // Interval cleanup
  // -----------------------------------------------------------------------

  it('stops polling when stopMonitoring is called', async () => {
    const mockWg = createMockWebGazer()
    const { initialize, startMonitoring, stopMonitoring } = useEyeTracking({
      webgazer: mockWg,
      checkIntervalMs: 100,
    })

    await initialize()
    startMonitoring()

    // One check fires
    await vi.advanceTimersByTimeAsync(100)
    expect(mockWg.getCurrentPrediction).toHaveBeenCalledTimes(1)

    stopMonitoring()

    // No more checks should fire
    await vi.advanceTimersByTimeAsync(500)
    expect(mockWg.getCurrentPrediction).toHaveBeenCalledTimes(1)
  })

  // -----------------------------------------------------------------------
  // Edge case: null coordinates
  // -----------------------------------------------------------------------

  it('treats prediction with null x/y as gaze lost', async () => {
    let returnNull = false
    const mockWg = createMockWebGazer(() =>
      Promise.resolve(returnNull ? { x: null, y: null } as unknown as GazeData : { x: 100, y: 100 }),
    )
    const { state, initialize, startMonitoring } = useEyeTracking({
      webgazer: mockWg,
      checkIntervalMs: 100,
      gazeLostThresholdMs: 200,
    })

    await initialize()
    startMonitoring()

    // First check — valid gaze detected
    now = 1100
    await vi.advanceTimersByTimeAsync(100)
    expect(state.value.paused).toBe(false)

    // Switch to null x/y
    returnNull = true

    // Advance past threshold
    now = 1400
    await vi.advanceTimersByTimeAsync(300)

    expect(state.value.paused).toBe(true)
    expect(state.value.pauseMessage).toBe('Please look at the screen')
  })

  it('does not pause when gaze was never detected', async () => {
    const mockWg = createMockWebGazer(() => Promise.resolve(null))
    const { state, initialize, startMonitoring } = useEyeTracking({
      webgazer: mockWg,
      checkIntervalMs: 100,
      gazeLostThresholdMs: 200,
    })

    await initialize()
    startMonitoring()

    // Advance well past threshold — should NOT pause
    now = 2000
    await vi.advanceTimersByTimeAsync(1000)

    expect(state.value.paused).toBe(false)
    expect(state.value.monitoring).toBe(true)
  })
})
