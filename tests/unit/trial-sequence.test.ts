import { describe, it, expect } from 'vitest'
import {
  calculateJitteredITI,
  generateTrialSequence,
  shuffleWithConstraint,
  isSequenceBalanced,
  type Cue,
  type Trial,
} from '../../app/composables/useTrialSequence'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCues(count: number): Cue[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cue-${i}`,
    src: `/images/cue-${i}.svg`,
    name: `Cue ${i}`,
  }))
}

/** Deterministic RNG using a simple seed for reproducible tests. */
function seededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---------------------------------------------------------------------------
// calculateJitteredITI
// ---------------------------------------------------------------------------

describe('calculateJitteredITI', () => {
  it('returns min when rng returns 0', () => {
    expect(calculateJitteredITI(500, 1500, () => 0)).toBe(500)
  })

  it('returns max when rng returns 1', () => {
    expect(calculateJitteredITI(500, 1500, () => 1)).toBe(1500)
  })

  it('returns midpoint when rng returns 0.5', () => {
    expect(calculateJitteredITI(500, 1500, () => 0.5)).toBe(1000)
  })

  it('returns min when min equals max', () => {
    expect(calculateJitteredITI(700, 700, () => 0.5)).toBe(700)
  })

  it('rounds to nearest integer', () => {
    // 500 + 0.33 * 1000 = 830
    expect(calculateJitteredITI(500, 1500, () => 0.33)).toBe(830)
  })
})

// ---------------------------------------------------------------------------
// generateTrialSequence
// ---------------------------------------------------------------------------

describe('generateTrialSequence', () => {
  it('generates correct total number of trials', () => {
    const cues = makeCues(6)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(42))
    expect(trials.length).toBe(6 * 12)
  })

  it('each cue appears exactly repsPerCue times', () => {
    const cues = makeCues(8)
    const reps = 12
    const trials = generateTrialSequence(cues, reps, 500, 1500, seededRng(123))

    for (let ci = 0; ci < cues.length; ci++) {
      const count = trials.filter(t => t.cueIndex === ci).length
      expect(count).toBe(reps)
    }
  })

  it('each cue has equal think/no-think split', () => {
    const cues = makeCues(6)
    const reps = 12
    const trials = generateTrialSequence(cues, reps, 500, 1500, seededRng(99))

    for (let ci = 0; ci < cues.length; ci++) {
      const cueTrials = trials.filter(t => t.cueIndex === ci)
      const thinkCount = cueTrials.filter(t => t.condition === 'think').length
      const noThinkCount = cueTrials.filter(t => t.condition === 'no-think').length
      expect(thinkCount).toBe(reps / 2)
      expect(noThinkCount).toBe(reps / 2)
    }
  })

  it('handles odd repsPerCue (floor division for think count)', () => {
    const cues = makeCues(4)
    const reps = 13
    const trials = generateTrialSequence(cues, reps, 500, 1500, seededRng(7))

    for (let ci = 0; ci < cues.length; ci++) {
      const cueTrials = trials.filter(t => t.cueIndex === ci)
      expect(cueTrials.length).toBe(reps)
      const thinkCount = cueTrials.filter(t => t.condition === 'think').length
      const noThinkCount = cueTrials.filter(t => t.condition === 'no-think').length
      // floor(13/2) = 6 think, 7 no-think
      expect(thinkCount).toBe(6)
      expect(noThinkCount).toBe(7)
    }
  })

  it('ITI values are within specified range', () => {
    const cues = makeCues(6)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(42))

    for (const trial of trials) {
      expect(trial.itiMs).toBeGreaterThanOrEqual(500)
      expect(trial.itiMs).toBeLessThanOrEqual(1500)
    }
  })

  it('is pseudo-randomized (not in original order)', () => {
    const cues = makeCues(6)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(42))

    // Check that it's not sorted by cueIndex
    const cueIndices = trials.map(t => t.cueIndex)
    const sorted = [...cueIndices].sort((a, b) => a - b)
    expect(cueIndices).not.toEqual(sorted)
  })

  it('no condition runs longer than 3 in a row', () => {
    const cues = makeCues(6)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(42))

    let runLen = 1
    for (let i = 1; i < trials.length; i++) {
      if (trials[i].condition === trials[i - 1].condition) {
        runLen++
        expect(runLen).toBeLessThanOrEqual(3)
      } else {
        runLen = 1
      }
    }
  })

  it('produces different sequences with different seeds', () => {
    const cues = makeCues(6)
    const trials1 = generateTrialSequence(cues, 12, 500, 1500, seededRng(1))
    const trials2 = generateTrialSequence(cues, 12, 500, 1500, seededRng(2))

    const conditions1 = trials1.map(t => t.condition)
    const conditions2 = trials2.map(t => t.condition)
    expect(conditions1).not.toEqual(conditions2)
  })
})

// ---------------------------------------------------------------------------
// shuffleWithConstraint
// ---------------------------------------------------------------------------

describe('shuffleWithConstraint', () => {
  it('breaks up long runs of the same condition', () => {
    // Create a worst-case input: all think then all no-think
    const trials: Trial[] = [
      ...Array.from({ length: 10 }, () => ({ cueIndex: 0, condition: 'think' as const, itiMs: 500 })),
      ...Array.from({ length: 10 }, () => ({ cueIndex: 0, condition: 'no-think' as const, itiMs: 500 })),
    ]

    shuffleWithConstraint(trials, 3, seededRng(42))

    let maxRun = 1
    let runLen = 1
    for (let i = 1; i < trials.length; i++) {
      if (trials[i].condition === trials[i - 1].condition) {
        runLen++
        if (runLen > maxRun) maxRun = runLen
      } else {
        runLen = 1
      }
    }
    expect(maxRun).toBeLessThanOrEqual(3)
  })

  it('preserves trial count', () => {
    const trials: Trial[] = Array.from({ length: 20 }, (_, i) => ({
      cueIndex: i % 4,
      condition: (i % 2 === 0 ? 'think' : 'no-think') as Condition,
      itiMs: 500,
    }))

    shuffleWithConstraint(trials, 3, seededRng(77))
    expect(trials.length).toBe(20)
  })

  it('preserves condition counts', () => {
    const trials: Trial[] = Array.from({ length: 24 }, (_, i) => ({
      cueIndex: i % 6,
      condition: (i % 2 === 0 ? 'think' : 'no-think') as Condition,
      itiMs: 500,
    }))

    const thinkBefore = trials.filter(t => t.condition === 'think').length
    const noThinkBefore = trials.filter(t => t.condition === 'no-think').length

    shuffleWithConstraint(trials, 3, seededRng(55))

    const thinkAfter = trials.filter(t => t.condition === 'think').length
    const noThinkAfter = trials.filter(t => t.condition === 'no-think').length

    expect(thinkAfter).toBe(thinkBefore)
    expect(noThinkAfter).toBe(noThinkBefore)
  })
})

// ---------------------------------------------------------------------------
// isSequenceBalanced
// ---------------------------------------------------------------------------

describe('isSequenceBalanced', () => {
  it('returns true for empty sequence', () => {
    expect(isSequenceBalanced([])).toBe(true)
  })

  it('returns true for perfectly balanced sequence', () => {
    const trials: Trial[] = [
      { cueIndex: 0, condition: 'think', itiMs: 500 },
      { cueIndex: 0, condition: 'no-think', itiMs: 500 },
      { cueIndex: 1, condition: 'think', itiMs: 500 },
      { cueIndex: 1, condition: 'no-think', itiMs: 500 },
    ]
    expect(isSequenceBalanced(trials)).toBe(true)
  })

  it('returns true for a real generated sequence', () => {
    const cues = makeCues(6)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(42))
    expect(isSequenceBalanced(trials)).toBe(true)
  })

  it('returns false for heavily imbalanced sequence', () => {
    const trials: Trial[] = Array.from({ length: 100 }, () => ({
      cueIndex: 0,
      condition: 'think' as const,
      itiMs: 500,
    }))
    expect(isSequenceBalanced(trials)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Full sequence integration tests
// ---------------------------------------------------------------------------

describe('generateTrialSequence integration', () => {
  it('works with minimum 6 cues at 12 reps', () => {
    const cues = makeCues(6)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(42))

    // Total = 6 * 12 = 72
    expect(trials.length).toBe(72)

    // Each cue appears 12 times
    for (let ci = 0; ci < 6; ci++) {
      expect(trials.filter(t => t.cueIndex === ci).length).toBe(12)
    }

    // Balanced
    expect(isSequenceBalanced(trials)).toBe(true)

    // Run constraint
    let runLen = 1
    for (let i = 1; i < trials.length; i++) {
      if (trials[i].condition === trials[i - 1].condition) {
        runLen++
        expect(runLen).toBeLessThanOrEqual(3)
      } else {
        runLen = 1
      }
    }
  })

  it('works with larger cue sets', () => {
    const cues = makeCues(12)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(99))

    expect(trials.length).toBe(144)
    expect(isSequenceBalanced(trials)).toBe(true)
  })

  it('ITI jitter produces variety', () => {
    const cues = makeCues(6)
    const trials = generateTrialSequence(cues, 12, 500, 1500, seededRng(42))

    const uniqueITIs = new Set(trials.map(t => t.itiMs))
    // With 72 trials and continuous jitter, should have multiple unique values
    expect(uniqueITIs.size).toBeGreaterThan(1)
  })
})
