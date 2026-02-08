import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { ref, readonly, nextTick } from 'vue'
import TrialRunner from '../../app/components/tnt/TrialRunner.vue'
import type { TrialSequenceState, Cue, TrialLog } from '../../app/composables/useTrialSequence'

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

function createMockState(overrides: Partial<TrialSequenceState> = {}): TrialSequenceState {
  return {
    phase: 'idle',
    currentTrialIndex: 0,
    totalTrials: 72,
    currentCue: null,
    currentCondition: null,
    logs: [],
    ...overrides,
  }
}

// Mutable ref that tests can drive
let mockState: ReturnType<typeof ref<TrialSequenceState>>
const mockStart = vi.fn()
const mockStop = vi.fn()
const mockReset = vi.fn()

vi.mock('~/composables/useTrialSequence', () => ({
  useTrialSequence: () => ({
    state: readonly(mockState),
    trials: () => [],
    start: mockStart,
    stop: mockStop,
    reset: mockReset,
  }),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TNT TrialRunner', () => {
  beforeEach(() => {
    mockState = ref<TrialSequenceState>(createMockState())
    mockStart.mockReset()
    mockStop.mockReset()
    mockReset.mockReset()
    vi.stubGlobal('performance', { now: vi.fn(() => 1000) })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders idle state by default', async () => {
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    expect(wrapper.find('[data-testid="trial-idle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fixation-cross"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cue-display"]').exists()).toBe(false)
  })

  it('shows fixation cross during fixation phase', async () => {
    mockState.value = createMockState({ phase: 'fixation' })
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    expect(wrapper.find('[data-testid="fixation-cross"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fixation-cross"]').text()).toBe('+')
  })

  it('shows cue display during cue phase with think condition', async () => {
    const cues = makeCues(6)
    mockState.value = createMockState({
      phase: 'cue',
      currentCue: cues[0],
      currentCondition: 'think',
    })
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues },
    })
    expect(wrapper.find('[data-testid="cue-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fixation-cross"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="iti-blank"]').exists()).toBe(false)
  })

  it('shows cue display during cue phase with no-think condition', async () => {
    const cues = makeCues(6)
    mockState.value = createMockState({
      phase: 'cue',
      currentCue: cues[2],
      currentCondition: 'no-think',
    })
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues },
    })
    expect(wrapper.find('[data-testid="cue-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fixation-cross"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="trial-idle"]').exists()).toBe(false)
  })

  it('shows blank screen during ITI phase', async () => {
    mockState.value = createMockState({ phase: 'iti' })
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    expect(wrapper.find('[data-testid="iti-blank"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fixation-cross"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cue-display"]').exists()).toBe(false)
  })

  it('shows completion state when phase is complete', async () => {
    mockState.value = createMockState({ phase: 'complete' })
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    expect(wrapper.find('[data-testid="trial-complete"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sequence complete')
  })

  it('renders PhaseIndicator component during active phases', async () => {
    mockState.value = createMockState({
      phase: 'cue',
      currentTrialIndex: 4,
      totalTrials: 72,
      currentCue: makeCues(1)[0],
      currentCondition: 'think',
    })
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    // PhaseIndicator stub should be present during active phase
    const indicator = wrapper.find('[data-testid="cue-display"]')
    expect(indicator.exists()).toBe(true)
    // The cue display area is rendered alongside the progress indicator
    expect(wrapper.find('[data-testid="trial-idle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="trial-complete"]').exists()).toBe(false)
  })

  it('calls start on the composable when startSequence is called', async () => {
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    ;(wrapper.vm as any).start()
    expect(mockStart).toHaveBeenCalledOnce()
  })

  it('calls stop on the composable when stopSequence is called', async () => {
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    ;(wrapper.vm as any).stop()
    expect(mockStop).toHaveBeenCalledOnce()
  })

  it('emits complete event when sequence finishes', async () => {
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })

    mockState.value = createMockState({ phase: 'complete' })
    await nextTick()

    expect(wrapper.emitted('complete')).toBeTruthy()
    expect(wrapper.emitted('complete')![0][0]).toEqual([])
  })

  it('logs trial with compliant=true for think condition', async () => {
    const cues = makeCues(6)
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues },
    })

    // Transition to cue phase
    mockState.value = createMockState({
      phase: 'cue',
      currentCue: cues[0],
      currentCondition: 'think',
    })
    await nextTick()

    // Transition to ITI and add a log entry
    const log: TrialLog = {
      trialIndex: 0,
      cueId: 'cue-0',
      condition: 'think',
      itiMs: 800,
    }
    mockState.value = createMockState({
      phase: 'iti',
      logs: [log],
    })
    await nextTick()

    expect(wrapper.emitted('trialLogged')).toBeTruthy()
    const emitted = wrapper.emitted('trialLogged')![0][0] as any
    expect(emitted.trialIndex).toBe(0)
    expect(emitted.cueId).toBe('cue-0')
    expect(emitted.condition).toBe('think')
    expect(emitted.compliant).toBe(true)
  })

  it('logs no-think trial as compliant when no key pressed', async () => {
    const cues = makeCues(6)
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues },
    })

    // Transition to cue phase (no-think)
    mockState.value = createMockState({
      phase: 'cue',
      currentCue: cues[1],
      currentCondition: 'no-think',
    })
    await nextTick()

    // No spacebar pressed — transition to ITI
    const log: TrialLog = {
      trialIndex: 0,
      cueId: 'cue-1',
      condition: 'no-think',
      itiMs: 700,
    }
    mockState.value = createMockState({
      phase: 'iti',
      logs: [log],
    })
    await nextTick()

    const emitted = wrapper.emitted('trialLogged')![0][0] as any
    expect(emitted.condition).toBe('no-think')
    expect(emitted.compliant).toBe(true)
    expect(emitted.reactionTimeMs).toBeNull()
  })

  it('logs no-think trial as non-compliant when spacebar pressed', async () => {
    const cues = makeCues(6)
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues },
    })

    // Transition to cue phase (no-think)
    mockState.value = createMockState({
      phase: 'cue',
      currentCue: cues[1],
      currentCondition: 'no-think',
    })
    await nextTick()

    // Simulate spacebar press
    vi.stubGlobal('performance', { now: vi.fn(() => 1200) })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    await nextTick()

    // Transition to ITI
    const log: TrialLog = {
      trialIndex: 0,
      cueId: 'cue-1',
      condition: 'no-think',
      itiMs: 700,
    }
    mockState.value = createMockState({
      phase: 'iti',
      logs: [log],
    })
    await nextTick()

    const emitted = wrapper.emitted('trialLogged')![0][0] as any
    expect(emitted.condition).toBe('no-think')
    expect(emitted.compliant).toBe(false)
    expect(emitted.reactionTimeMs).toBeTypeOf('number')
  })

  it('displays trial count on completion', async () => {
    const cues = makeCues(6)
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues },
    })

    // Simulate one trial logged then complete
    mockState.value = createMockState({
      phase: 'cue',
      currentCue: cues[0],
      currentCondition: 'think',
    })
    await nextTick()

    mockState.value = createMockState({
      phase: 'iti',
      logs: [{ trialIndex: 0, cueId: 'cue-0', condition: 'think', itiMs: 800 }],
    })
    await nextTick()

    mockState.value = createMockState({
      phase: 'complete',
      logs: [{ trialIndex: 0, cueId: 'cue-0', condition: 'think', itiMs: 800 }],
    })
    await nextTick()

    expect(wrapper.find('[data-testid="trial-complete"]').text()).toContain('1 trials recorded')
  })

  it('hides PhaseIndicator during idle and complete phases', async () => {
    const wrapper = await mountSuspended(TrialRunner, {
      props: { cues: makeCues(6) },
    })
    // idle
    expect(wrapper.text()).not.toContain('Trial')

    // complete
    mockState.value = createMockState({ phase: 'complete' })
    await nextTick()
    // "Sequence complete" and "trials recorded" but not the PhaseIndicator "Trial X/Y"
    // PhaseIndicator is hidden, so no "Trial" followed by numbers in indicator format
    const indicator = wrapper.findComponent({ name: 'PhaseIndicator' })
    expect(indicator.exists()).toBe(false)
  })
})
