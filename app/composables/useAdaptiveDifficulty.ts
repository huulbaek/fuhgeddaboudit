/**
 * Adaptive difficulty composable for the Tetris visuospatial interference task.
 *
 * Uses a staircase algorithm to maintain ~70% success rate (flow state).
 * Tracks lines/min and piece survival time to adjust gravity speed.
 * Too easy → mind wanders back to trauma; too hard → user quits.
 */

export interface AdaptiveDifficultyOptions {
  /** Starting gravity interval in ms (default 600). */
  initialGravityMs?: number
  /** Minimum gravity interval in ms — max speed (default 100). */
  minGravityMs?: number
  /** Maximum gravity interval in ms — min speed (default 1200). */
  maxGravityMs?: number
  /** Evaluation window in ms — how often to reassess (default 30000 = 30s). */
  evaluationWindowMs?: number
  /** Target success rate — pieces that survive long enough (default 0.70). */
  targetSuccessRate?: number
  /** Adjustment factor — how much to change gravity per evaluation (default 0.10). */
  adjustmentFactor?: number
  /** Minimum piece survival time in ms to count as "successful" (default 2000). */
  successThresholdMs?: number
}

export interface PieceRecord {
  /** How long the piece was alive before locking (ms). */
  survivalMs: number
  /** Number of lines cleared when this piece locked (0 if none). */
  linesCleared: number
  /** Whether the player rotated the piece at least once. */
  wasRotated: boolean
  /** Timestamp when the piece was recorded. */
  timestamp: number
}

export interface AdaptiveDifficultyState {
  /** Current recommended gravity interval in ms. */
  gravityMs: number
  /** Rolling success rate (0-1) from the last evaluation window. */
  currentSuccessRate: number
  /** Total pieces recorded. */
  totalPieces: number
  /** Total lines cleared. */
  totalLines: number
  /** Lines per minute (rolling, from evaluation window). */
  linesPerMinute: number
  /** Number of difficulty adjustments made. */
  adjustmentCount: number
}

const DEFAULTS: Required<AdaptiveDifficultyOptions> = {
  initialGravityMs: 600,
  minGravityMs: 100,
  maxGravityMs: 1200,
  evaluationWindowMs: 30_000,
  targetSuccessRate: 0.70,
  adjustmentFactor: 0.10,
  successThresholdMs: 2000,
}

/**
 * Calculate the success rate from a set of piece records.
 * A piece is "successful" if it survived longer than the threshold.
 */
export function calculateSuccessRate(
  records: PieceRecord[],
  successThresholdMs: number,
): number {
  if (records.length === 0) return 0
  const successes = records.filter(r => r.survivalMs >= successThresholdMs).length
  return successes / records.length
}

/**
 * Calculate lines per minute from piece records within a time window.
 */
export function calculateLinesPerMinute(
  records: PieceRecord[],
  windowMs: number,
): number {
  if (records.length === 0 || windowMs <= 0) return 0
  const totalLines = records.reduce((sum, r) => sum + r.linesCleared, 0)
  return (totalLines / windowMs) * 60_000
}

/**
 * Determine the new gravity interval based on success rate vs target.
 * Speeds up (lower ms) if performing too well, slows down (higher ms) if failing.
 */
export function adjustGravity(
  currentGravityMs: number,
  successRate: number,
  targetRate: number,
  adjustmentFactor: number,
  minGravityMs: number,
  maxGravityMs: number,
): number {
  // Dead zone: ±5% around target = no change
  const tolerance = 0.05
  if (Math.abs(successRate - targetRate) <= tolerance) {
    return currentGravityMs
  }

  if (successRate > targetRate + tolerance) {
    // Too easy — speed up (decrease interval)
    const newGravity = currentGravityMs * (1 - adjustmentFactor)
    return Math.max(minGravityMs, Math.round(newGravity))
  } else {
    // Too hard — slow down (increase interval)
    const newGravity = currentGravityMs * (1 + adjustmentFactor)
    return Math.min(maxGravityMs, Math.round(newGravity))
  }
}

/**
 * Main composable. Returns reactive difficulty state and recording methods.
 */
export function useAdaptiveDifficulty(options: AdaptiveDifficultyOptions = {}) {
  const opts = { ...DEFAULTS, ...options }

  const allRecords: PieceRecord[] = []

  const state = ref<AdaptiveDifficultyState>({
    gravityMs: opts.initialGravityMs,
    currentSuccessRate: 0,
    totalPieces: 0,
    totalLines: 0,
    linesPerMinute: 0,
    adjustmentCount: 0,
  })

  let lastEvaluationTime = 0

  /**
   * Record a piece that was locked into the board.
   * Call this every time a piece lands. The composable evaluates difficulty
   * at regular intervals based on the evaluation window.
   */
  function recordPiece(record: Omit<PieceRecord, 'timestamp'>, now?: number) {
    const timestamp = now ?? Date.now()
    const entry: PieceRecord = { ...record, timestamp }
    allRecords.push(entry)

    state.value.totalPieces++
    state.value.totalLines += record.linesCleared

    // Initialize evaluation time on first piece
    if (lastEvaluationTime === 0) {
      lastEvaluationTime = timestamp
    }

    // Check if we should evaluate
    if (timestamp - lastEvaluationTime >= opts.evaluationWindowMs) {
      evaluate(timestamp)
    }
  }

  /**
   * Run an evaluation: look at recent records and adjust difficulty.
   */
  function evaluate(now?: number) {
    const timestamp = now ?? Date.now()
    const windowStart = timestamp - opts.evaluationWindowMs

    // Get records within the evaluation window
    const recentRecords = allRecords.filter(r => r.timestamp >= windowStart)

    if (recentRecords.length < 3) {
      // Not enough data — skip adjustment
      lastEvaluationTime = timestamp
      return
    }

    const successRate = calculateSuccessRate(recentRecords, opts.successThresholdMs)
    const linesPerMinute = calculateLinesPerMinute(recentRecords, opts.evaluationWindowMs)

    const newGravity = adjustGravity(
      state.value.gravityMs,
      successRate,
      opts.targetSuccessRate,
      opts.adjustmentFactor,
      opts.minGravityMs,
      opts.maxGravityMs,
    )

    const didAdjust = newGravity !== state.value.gravityMs

    state.value = {
      ...state.value,
      gravityMs: newGravity,
      currentSuccessRate: successRate,
      linesPerMinute,
      adjustmentCount: state.value.adjustmentCount + (didAdjust ? 1 : 0),
    }

    lastEvaluationTime = timestamp

    // Prune old records to prevent unbounded growth
    const pruneThreshold = timestamp - opts.evaluationWindowMs * 2
    while (allRecords.length > 0 && allRecords[0]!.timestamp < pruneThreshold) {
      allRecords.shift()
    }
  }

  /** Reset all state to initial values. */
  function reset() {
    allRecords.length = 0
    lastEvaluationTime = 0
    state.value = {
      gravityMs: opts.initialGravityMs,
      currentSuccessRate: 0,
      totalPieces: 0,
      totalLines: 0,
      linesPerMinute: 0,
      adjustmentCount: 0,
    }
  }

  return {
    state: readonly(state),
    recordPiece,
    evaluate,
    reset,
  }
}
