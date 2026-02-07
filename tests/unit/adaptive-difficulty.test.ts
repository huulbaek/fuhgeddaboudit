import { describe, it, expect } from 'vitest'
import {
  calculateSuccessRate,
  calculateLinesPerMinute,
  adjustGravity,
  useAdaptiveDifficulty,
  type PieceRecord,
} from '../../app/composables/useAdaptiveDifficulty'

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('calculateSuccessRate', () => {
  it('returns 0 for empty records', () => {
    expect(calculateSuccessRate([], 2000)).toBe(0)
  })

  it('returns 1 when all pieces survive above threshold', () => {
    const records: PieceRecord[] = [
      { survivalMs: 3000, linesCleared: 1, wasRotated: true, timestamp: 1000 },
      { survivalMs: 5000, linesCleared: 0, wasRotated: false, timestamp: 2000 },
    ]
    expect(calculateSuccessRate(records, 2000)).toBe(1)
  })

  it('returns 0 when all pieces fail below threshold', () => {
    const records: PieceRecord[] = [
      { survivalMs: 500, linesCleared: 0, wasRotated: false, timestamp: 1000 },
      { survivalMs: 1000, linesCleared: 0, wasRotated: false, timestamp: 2000 },
    ]
    expect(calculateSuccessRate(records, 2000)).toBe(0)
  })

  it('calculates correct rate for mixed results', () => {
    const records: PieceRecord[] = [
      { survivalMs: 3000, linesCleared: 1, wasRotated: true, timestamp: 1000 },
      { survivalMs: 500, linesCleared: 0, wasRotated: false, timestamp: 2000 },
      { survivalMs: 4000, linesCleared: 2, wasRotated: true, timestamp: 3000 },
      { survivalMs: 1000, linesCleared: 0, wasRotated: false, timestamp: 4000 },
    ]
    // 2 out of 4 succeed
    expect(calculateSuccessRate(records, 2000)).toBe(0.5)
  })

  it('includes pieces exactly at threshold as successful', () => {
    const records: PieceRecord[] = [
      { survivalMs: 2000, linesCleared: 0, wasRotated: false, timestamp: 1000 },
    ]
    expect(calculateSuccessRate(records, 2000)).toBe(1)
  })
})

describe('calculateLinesPerMinute', () => {
  it('returns 0 for empty records', () => {
    expect(calculateLinesPerMinute([], 30000)).toBe(0)
  })

  it('returns 0 for zero window', () => {
    const records: PieceRecord[] = [
      { survivalMs: 3000, linesCleared: 2, wasRotated: true, timestamp: 1000 },
    ]
    expect(calculateLinesPerMinute(records, 0)).toBe(0)
  })

  it('calculates lines per minute correctly', () => {
    const records: PieceRecord[] = [
      { survivalMs: 3000, linesCleared: 2, wasRotated: true, timestamp: 1000 },
      { survivalMs: 4000, linesCleared: 1, wasRotated: true, timestamp: 5000 },
      { survivalMs: 2000, linesCleared: 0, wasRotated: false, timestamp: 8000 },
    ]
    // 3 lines in 30s window → 6 lines/min
    expect(calculateLinesPerMinute(records, 30_000)).toBe(6)
  })
})

describe('adjustGravity', () => {
  const minGravity = 100
  const maxGravity = 1200
  const target = 0.70
  const factor = 0.10

  it('speeds up (decreases interval) when success rate is too high', () => {
    const result = adjustGravity(600, 0.90, target, factor, minGravity, maxGravity)
    // 600 * (1 - 0.10) = 540
    expect(result).toBe(540)
  })

  it('slows down (increases interval) when success rate is too low', () => {
    const result = adjustGravity(600, 0.40, target, factor, minGravity, maxGravity)
    // 600 * (1 + 0.10) = 660
    expect(result).toBe(660)
  })

  it('keeps gravity unchanged within tolerance zone (±5%)', () => {
    // 0.70 target, tolerance ±0.05 → no change for 0.68 (within 0.65-0.75)
    const result = adjustGravity(600, 0.68, target, factor, minGravity, maxGravity)
    expect(result).toBe(600)
  })

  it('keeps gravity unchanged at exactly target rate', () => {
    const result = adjustGravity(600, 0.70, target, factor, minGravity, maxGravity)
    expect(result).toBe(600)
  })

  it('respects minimum gravity (max speed)', () => {
    const result = adjustGravity(105, 0.95, target, factor, minGravity, maxGravity)
    // 105 * 0.9 = 94.5 → clamped to 100
    expect(result).toBe(minGravity)
  })

  it('respects maximum gravity (min speed)', () => {
    const result = adjustGravity(1150, 0.20, target, factor, minGravity, maxGravity)
    // 1150 * 1.1 = 1265 → clamped to 1200
    expect(result).toBe(maxGravity)
  })

  it('rounds to nearest integer', () => {
    const result = adjustGravity(333, 0.90, target, factor, minGravity, maxGravity)
    // 333 * 0.9 = 299.7 → 300
    expect(result).toBe(300)
  })
})

// ---------------------------------------------------------------------------
// Composable integration tests
// ---------------------------------------------------------------------------

describe('useAdaptiveDifficulty composable', () => {
  it('starts with initial gravity', () => {
    const difficulty = useAdaptiveDifficulty({ initialGravityMs: 500 })
    expect(difficulty.state.value.gravityMs).toBe(500)
  })

  it('uses default gravity of 600ms', () => {
    const difficulty = useAdaptiveDifficulty()
    expect(difficulty.state.value.gravityMs).toBe(600)
  })

  it('tracks total pieces and lines', () => {
    const difficulty = useAdaptiveDifficulty({ evaluationWindowMs: 60_000 })
    difficulty.recordPiece({ survivalMs: 3000, linesCleared: 2, wasRotated: true }, 1000)
    difficulty.recordPiece({ survivalMs: 4000, linesCleared: 1, wasRotated: false }, 2000)

    expect(difficulty.state.value.totalPieces).toBe(2)
    expect(difficulty.state.value.totalLines).toBe(3)
  })

  it('does not adjust before evaluation window elapses', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 30_000,
    })

    // Record pieces all within 10 seconds — well before 30s window
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 5000, linesCleared: 1, wasRotated: true },
        1000 + i * 1000,
      )
    }

    // Gravity should be unchanged since window hasn't elapsed
    expect(difficulty.state.value.gravityMs).toBe(600)
  })

  it('speeds up when success rate exceeds target after evaluation', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 5_000,
      successThresholdMs: 2000,
    })

    const baseTime = 1000
    // Record 10 highly successful pieces over ~6 seconds (exceeds 5s window)
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 5000, linesCleared: 1, wasRotated: true },
        baseTime + i * 600,
      )
    }

    // All pieces have survivalMs 5000 > 2000 threshold → 100% success
    // Should speed up: 600 * 0.9 = 540
    expect(difficulty.state.value.gravityMs).toBe(540)
    expect(difficulty.state.value.adjustmentCount).toBe(1)
  })

  it('slows down when success rate is below target after evaluation', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 5_000,
      successThresholdMs: 2000,
    })

    const baseTime = 1000
    // Record 10 failing pieces over ~6 seconds (exceeds 5s window)
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 500, linesCleared: 0, wasRotated: false },
        baseTime + i * 600,
      )
    }

    // 0% success rate → should slow down: 600 * 1.1 = 660
    expect(difficulty.state.value.gravityMs).toBe(660)
    expect(difficulty.state.value.adjustmentCount).toBe(1)
  })

  it('does not adjust when success rate is within tolerance of target', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 10_000,
      successThresholdMs: 2000,
      targetSuccessRate: 0.70,
    })

    const baseTime = 1000
    // 7 successes, 3 failures = 70% — exactly on target
    for (let i = 0; i < 10; i++) {
      const isSuccess = i < 7
      difficulty.recordPiece(
        {
          survivalMs: isSuccess ? 5000 : 500,
          linesCleared: isSuccess ? 1 : 0,
          wasRotated: isSuccess,
        },
        baseTime + i * 1100,
      )
    }

    expect(difficulty.state.value.gravityMs).toBe(600)
    expect(difficulty.state.value.adjustmentCount).toBe(0)
  })

  it('skips evaluation if fewer than 3 pieces in window', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 5_000,
      successThresholdMs: 2000,
    })

    // Record 2 pieces over 6 seconds (window elapses but only 1 recent piece)
    difficulty.recordPiece({ survivalMs: 500, linesCleared: 0, wasRotated: false }, 1000)
    difficulty.recordPiece({ survivalMs: 500, linesCleared: 0, wasRotated: false }, 7000)

    // Only 1 piece in recent 5s window → not enough data
    expect(difficulty.state.value.gravityMs).toBe(600)
  })

  it('clamps gravity to minimum (max speed)', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 110,
      minGravityMs: 100,
      evaluationWindowMs: 5_000,
      successThresholdMs: 1000,
    })

    const baseTime = 1000
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 5000, linesCleared: 2, wasRotated: true },
        baseTime + i * 600,
      )
    }

    // 110 * 0.9 = 99 → clamped to 100
    expect(difficulty.state.value.gravityMs).toBe(100)
  })

  it('clamps gravity to maximum (min speed)', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 1150,
      maxGravityMs: 1200,
      evaluationWindowMs: 5_000,
      successThresholdMs: 2000,
    })

    const baseTime = 1000
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 500, linesCleared: 0, wasRotated: false },
        baseTime + i * 600,
      )
    }

    // 1150 * 1.1 = 1265 → clamped to 1200
    expect(difficulty.state.value.gravityMs).toBe(1200)
  })

  it('updates linesPerMinute on evaluation', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 5_000,
      successThresholdMs: 2000,
    })

    // Use manual evaluate for precise control
    // Record 5 pieces within the window, each clearing 1 line
    for (let i = 0; i < 5; i++) {
      difficulty.recordPiece(
        { survivalMs: 3000, linesCleared: 1, wasRotated: true },
        1000 + i * 500,
      )
    }

    // Manually evaluate — 5 lines in 5s window → 60 lines/min
    difficulty.evaluate(3500)
    expect(difficulty.state.value.linesPerMinute).toBe(60)
  })

  it('manual evaluate() works', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 30_000,
      successThresholdMs: 2000,
    })

    // Record pieces without triggering auto-evaluate
    for (let i = 0; i < 5; i++) {
      difficulty.recordPiece(
        { survivalMs: 5000, linesCleared: 1, wasRotated: true },
        1000 + i * 1000,
      )
    }

    expect(difficulty.state.value.gravityMs).toBe(600)

    // Manually evaluate
    difficulty.evaluate(6000)

    // 100% success → should speed up
    expect(difficulty.state.value.gravityMs).toBe(540)
  })

  it('reset() restores initial state', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 5_000,
      successThresholdMs: 2000,
    })

    // Record some activity
    const baseTime = 1000
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 5000, linesCleared: 1, wasRotated: true },
        baseTime + i * 600,
      )
    }

    expect(difficulty.state.value.totalPieces).toBe(10)
    expect(difficulty.state.value.gravityMs).not.toBe(600) // Should have adjusted

    difficulty.reset()

    expect(difficulty.state.value.gravityMs).toBe(600)
    expect(difficulty.state.value.totalPieces).toBe(0)
    expect(difficulty.state.value.totalLines).toBe(0)
    expect(difficulty.state.value.currentSuccessRate).toBe(0)
    expect(difficulty.state.value.linesPerMinute).toBe(0)
    expect(difficulty.state.value.adjustmentCount).toBe(0)
  })

  it('performs multiple adjustments over time', () => {
    const difficulty = useAdaptiveDifficulty({
      initialGravityMs: 600,
      evaluationWindowMs: 5_000,
      successThresholdMs: 1000,
    })

    // First window: high success → speed up
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 3000, linesCleared: 1, wasRotated: true },
        1000 + i * 600,
      )
    }
    const afterFirst = difficulty.state.value.gravityMs
    expect(afterFirst).toBeLessThan(600) // Sped up

    // Second window: low success → slow down
    const baseTime2 = 10_000
    for (let i = 0; i < 10; i++) {
      difficulty.recordPiece(
        { survivalMs: 200, linesCleared: 0, wasRotated: false },
        baseTime2 + i * 600,
      )
    }
    const afterSecond = difficulty.state.value.gravityMs
    expect(afterSecond).toBeGreaterThan(afterFirst) // Slowed back down
    expect(difficulty.state.value.adjustmentCount).toBe(2)
  })
})
