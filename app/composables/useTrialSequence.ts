/**
 * Orchestrates the TNT (Think/No-Think) trial sequence.
 *
 * Trial cycle: fixation cross (500ms) → cue with frame (3000ms) → ITI (500–1500ms jittered).
 * Pseudo-randomized order with equal green (think) / red (no-think) split.
 * Minimum 12 repetitions per cue item.
 * Uses usePrecisionTimer for all timing.
 */

export interface Cue {
  id: string
  src: string
  name: string
}

export type TrialPhase = 'idle' | 'fixation' | 'cue' | 'iti' | 'complete'
export type Condition = 'think' | 'no-think'

export interface Trial {
  cueIndex: number
  condition: Condition
  itiMs: number
}

export interface TrialLog {
  trialIndex: number
  cueId: string
  condition: Condition
  itiMs: number
}

export interface TrialSequenceState {
  phase: TrialPhase
  currentTrialIndex: number
  totalTrials: number
  currentCue: Cue | null
  currentCondition: Condition | null
  logs: TrialLog[]
}

export interface TrialSequenceOptions {
  /** Duration of fixation cross in ms (default 500). */
  fixationMs?: number
  /** Duration of cue display in ms (default 3000). */
  cueMs?: number
  /** Minimum ITI in ms (default 500). */
  itiMinMs?: number
  /** Maximum ITI in ms (default 1500). */
  itiMaxMs?: number
  /** Minimum repetitions per cue item (default 12). */
  repsPerCue?: number
  /** RNG function for testability (default Math.random). */
  rng?: () => number
}

const FIXATION_MS = 500
const CUE_MS = 3000
const ITI_MIN_MS = 500
const ITI_MAX_MS = 1500
const REPS_PER_CUE = 12

/**
 * Generate a jittered ITI duration between min and max (inclusive).
 */
export function calculateJitteredITI(
  min: number,
  max: number,
  rng: () => number,
): number {
  return Math.round(min + rng() * (max - min))
}

/**
 * Build the full trial list: each cue appears `repsPerCue` times,
 * half as "think" and half as "no-think", then pseudo-randomized
 * with the constraint that no condition repeats more than 3 times in a row.
 */
export function generateTrialSequence(
  cues: Cue[],
  repsPerCue: number,
  itiMinMs: number,
  itiMaxMs: number,
  rng: () => number,
): Trial[] {
  const trials: Trial[] = []

  // For each cue, create repsPerCue trials with equal think/no-think split
  for (let ci = 0; ci < cues.length; ci++) {
    const halfReps = Math.floor(repsPerCue / 2)
    for (let r = 0; r < repsPerCue; r++) {
      trials.push({
        cueIndex: ci,
        condition: r < halfReps ? 'think' : 'no-think',
        itiMs: calculateJitteredITI(itiMinMs, itiMaxMs, rng),
      })
    }
  }

  // Fisher-Yates shuffle with run-length constraint
  shuffleWithConstraint(trials, 3, rng)

  return trials
}

/**
 * Shuffle trials in-place using Fisher-Yates, then fix runs where
 * the same condition appears more than `maxRun` times consecutively.
 */
export function shuffleWithConstraint(
  trials: Trial[],
  maxRun: number,
  rng: () => number,
): void {
  // Fisher-Yates shuffle
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = trials[i]
    trials[i] = trials[j]
    trials[j] = tmp
  }

  // Fix runs that exceed maxRun
  for (let attempts = 0; attempts < trials.length * 2; attempts++) {
    const runStart = findLongRun(trials, maxRun)
    if (runStart === -1) break

    // Find a swap candidate: the element at runStart + maxRun
    // should be swapped with a non-adjacent element of the opposite condition
    const badIdx = runStart + maxRun
    if (badIdx >= trials.length) break

    const targetCondition = trials[badIdx].condition === 'think' ? 'no-think' : 'think'
    let swapped = false
    for (let k = 0; k < trials.length; k++) {
      if (Math.abs(k - badIdx) < 2) continue
      if (trials[k].condition === targetCondition) {
        // Check the swap won't create a new long run at position k
        const tmp = trials[badIdx]
        trials[badIdx] = trials[k]
        trials[k] = tmp
        if (findLongRunAt(trials, maxRun, k) === -1) {
          swapped = true
          break
        }
        // Undo swap
        trials[k] = trials[badIdx]
        trials[badIdx] = tmp
      }
    }
    if (!swapped) break
  }
}

/** Find the start index of the first run exceeding maxRun, or -1. */
function findLongRun(trials: Trial[], maxRun: number): number {
  let runLen = 1
  for (let i = 1; i < trials.length; i++) {
    if (trials[i].condition === trials[i - 1].condition) {
      runLen++
      if (runLen > maxRun) return i - runLen + 1
    } else {
      runLen = 1
    }
  }
  return -1
}

/** Check if a specific position is part of a run exceeding maxRun. */
function findLongRunAt(trials: Trial[], maxRun: number, pos: number): number {
  // Find the start of the run containing pos
  let start = pos
  while (start > 0 && trials[start - 1].condition === trials[pos].condition) start--
  let end = pos
  while (end < trials.length - 1 && trials[end + 1].condition === trials[pos].condition) end++
  const runLen = end - start + 1
  return runLen > maxRun ? start : -1
}

/**
 * Check that each condition has roughly equal representation.
 */
export function isSequenceBalanced(trials: Trial[]): boolean {
  if (trials.length === 0) return true
  const thinkCount = trials.filter(t => t.condition === 'think').length
  const noThinkCount = trials.filter(t => t.condition === 'no-think').length
  // Allow ±1 difference per cue (for odd repsPerCue)
  return Math.abs(thinkCount - noThinkCount) <= Math.ceil(trials.length / 12)
}

/**
 * Main composable. Orchestrates the trial sequence with precision timing.
 */
export function useTrialSequence(cuesInput: MaybeRefOrGetter<Cue[]>, options: TrialSequenceOptions = {}) {
  const fixationMs = options.fixationMs ?? FIXATION_MS
  const cueMs = options.cueMs ?? CUE_MS
  const itiMinMs = options.itiMinMs ?? ITI_MIN_MS
  const itiMaxMs = options.itiMaxMs ?? ITI_MAX_MS
  const repsPerCue = options.repsPerCue ?? REPS_PER_CUE
  const rng = options.rng ?? Math.random

  const timer = usePrecisionTimer()
  let trials: Trial[] = []
  let activeCues: Cue[] = []

  const state = ref<TrialSequenceState>({
    phase: 'idle',
    currentTrialIndex: 0,
    totalTrials: 0,
    currentCue: null,
    currentCondition: null,
    logs: [],
  })

  function runTrial(index: number) {
    if (index >= trials.length) {
      state.value = { ...state.value, phase: 'complete', currentCue: null, currentCondition: null }
      timer.stop()
      return
    }

    const trial = trials[index]
    const cue = activeCues[trial.cueIndex]

    // Phase: fixation
    state.value = {
      ...state.value,
      phase: 'fixation',
      currentTrialIndex: index,
      currentCue: null,
      currentCondition: null,
    }

    timer.stop()
    // Clear previously scheduled events by creating fresh timer cycle
    const trialTimer = usePrecisionTimer()

    // Schedule cue phase after fixation
    trialTimer.scheduleAt(fixationMs, () => {
      state.value = {
        ...state.value,
        phase: 'cue',
        currentCue: cue,
        currentCondition: trial.condition,
      }
    })

    // Schedule ITI phase after fixation + cue
    trialTimer.scheduleAt(fixationMs + cueMs, () => {
      state.value = {
        ...state.value,
        phase: 'iti',
        currentCue: null,
        currentCondition: null,
      }

      // Log this trial
      state.value.logs.push({
        trialIndex: index,
        cueId: cue.id,
        condition: trial.condition,
        itiMs: trial.itiMs,
      })
    })

    // Schedule next trial after fixation + cue + ITI
    trialTimer.scheduleAt(fixationMs + cueMs + trial.itiMs, () => {
      trialTimer.stop()
      runTrial(index + 1)
    })

    trialTimer.start()
  }

  function start() {
    activeCues = toValue(cuesInput)
    trials = generateTrialSequence(activeCues, repsPerCue, itiMinMs, itiMaxMs, rng)
    state.value = {
      phase: 'idle',
      currentTrialIndex: 0,
      totalTrials: trials.length,
      currentCue: null,
      currentCondition: null,
      logs: [],
    }
    runTrial(0)
  }

  function stop() {
    timer.stop()
    state.value = { ...state.value, phase: 'idle', currentCue: null, currentCondition: null }
  }

  function reset() {
    timer.stop()
    trials = []
    state.value = {
      phase: 'idle',
      currentTrialIndex: 0,
      totalTrials: 0,
      currentCue: null,
      currentCondition: null,
      logs: [],
    }
  }

  return {
    state: readonly(state),
    trials: () => trials,
    start,
    stop,
    reset,
  }
}
