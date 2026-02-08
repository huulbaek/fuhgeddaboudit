/**
 * Integrates WebGazer.js for gaze monitoring during TNT no-think trials.
 *
 * - Initializes WebGazer on demand (requires user gesture / camera permission).
 * - During monitoring, checks gaze every 100ms.
 * - If gaze is lost for >200ms, pauses the trial and shows a prompt.
 * - Exposes reactive state for the UI layer to consume.
 */

export interface GazeData {
  x: number
  y: number
}

export interface EyeTrackingState {
  /** Whether WebGazer has been initialized and is ready. */
  initialized: boolean
  /** Whether gaze monitoring is currently active. */
  monitoring: boolean
  /** Whether the trial is paused due to lost gaze. */
  paused: boolean
  /** Message to display when paused. */
  pauseMessage: string | null
}

export interface EyeTrackingOptions {
  /** How often to check gaze in ms (default 100). */
  checkIntervalMs?: number
  /** How long gaze can be lost before pausing in ms (default 200). */
  gazeLostThresholdMs?: number
  /** Custom WebGazer instance for testing. */
  webgazer?: WebGazerInstance
}

/** Minimal interface for the WebGazer API surface we use. */
export interface WebGazerInstance {
  begin: () => Promise<void>
  end: () => void
  getCurrentPrediction: () => Promise<GazeData | null>
  showVideoPreview: (show: boolean) => WebGazerInstance
  showPredictionPoints: (show: boolean) => WebGazerInstance
  showFaceOverlay: (show: boolean) => WebGazerInstance
  showFaceFeedbackBox: (show: boolean) => WebGazerInstance
}

const CHECK_INTERVAL_MS = 100
const GAZE_LOST_THRESHOLD_MS = 200

let _webgazerModule: WebGazerInstance | null = null

/** Reset module-level state (for testing). */
export function _resetEyeTracking() {
  _webgazerModule = null
}

export function useEyeTracking(options: EyeTrackingOptions = {}) {
  const checkIntervalMs = options.checkIntervalMs ?? CHECK_INTERVAL_MS
  const gazeLostThresholdMs = options.gazeLostThresholdMs ?? GAZE_LOST_THRESHOLD_MS

  let gazeCheckTimer: ReturnType<typeof setInterval> | null = null
  let lastGazeTime = 0

  const state = ref<EyeTrackingState>({
    initialized: false,
    monitoring: false,
    paused: false,
    pauseMessage: null,
  })

  /**
   * Initialize WebGazer. Must be called after a user gesture (camera permission).
   * Hides all WebGazer UI overlays — we only need the gaze data.
   */
  async function initialize(): Promise<void> {
    if (state.value.initialized) return

    let wg = options.webgazer ?? _webgazerModule
    if (!wg) {
      const mod = await import('webgazer')
      wg = (mod.default ?? mod) as unknown as WebGazerInstance
      _webgazerModule = wg
    }

    // Hide all WebGazer visual chrome
    wg.showVideoPreview(false)
    wg.showPredictionPoints(false)
    wg.showFaceOverlay(false)
    wg.showFaceFeedbackBox(false)

    await wg.begin()

    state.value = { ...state.value, initialized: true }
  }

  /** Get the current WebGazer instance (null if not initialized). */
  function getWebGazer(): WebGazerInstance | null {
    return options.webgazer ?? _webgazerModule
  }

  /**
   * Start monitoring gaze. Checks every `checkIntervalMs`.
   * If gaze is null (lost) for longer than `gazeLostThresholdMs`,
   * sets paused=true with a prompt message.
   */
  function startMonitoring(): void {
    const wg = getWebGazer()
    if (!wg || !state.value.initialized) return
    if (state.value.monitoring) return

    lastGazeTime = performance.now()
    state.value = { ...state.value, monitoring: true, paused: false, pauseMessage: null }

    gazeCheckTimer = setInterval(async () => {
      const prediction = await wg.getCurrentPrediction()
      const now = performance.now()

      if (prediction && prediction.x !== null && prediction.y !== null) {
        // Gaze detected — reset timer and unpause if needed
        lastGazeTime = now
        if (state.value.paused) {
          state.value = { ...state.value, paused: false, pauseMessage: null }
        }
      } else {
        // Gaze lost — check if threshold exceeded
        const elapsed = now - lastGazeTime
        if (elapsed > gazeLostThresholdMs && !state.value.paused) {
          state.value = {
            ...state.value,
            paused: true,
            pauseMessage: 'Please look at the screen',
          }
        }
      }
    }, checkIntervalMs)
  }

  /** Stop monitoring gaze. Clears the check interval. */
  function stopMonitoring(): void {
    if (gazeCheckTimer !== null) {
      clearInterval(gazeCheckTimer)
      gazeCheckTimer = null
    }
    state.value = { ...state.value, monitoring: false, paused: false, pauseMessage: null }
  }

  /** Tear down WebGazer entirely. */
  function destroy(): void {
    stopMonitoring()
    const wg = getWebGazer()
    if (wg && state.value.initialized) {
      wg.end()
    }
    state.value = { initialized: false, monitoring: false, paused: false, pauseMessage: null }
  }

  return {
    state: readonly(state),
    initialize,
    startMonitoring,
    stopMonitoring,
    destroy,
  }
}
