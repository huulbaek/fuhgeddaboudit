import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { ref, readonly, nextTick } from 'vue'
import TntSessionPage from '../../app/pages/modules/tnt/session.vue'
import type { TrialSequenceState, Cue } from '../../app/composables/useTrialSequence'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

// Mock useTrialSequence (used by TrialRunner child component)
let mockTrialState: ReturnType<typeof ref<TrialSequenceState>>
const mockTrialStart = vi.fn()
const mockTrialStop = vi.fn()
const mockTrialReset = vi.fn()

vi.mock('~/composables/useTrialSequence', () => ({
  useTrialSequence: () => ({
    state: readonly(mockTrialState),
    trials: () => [],
    start: mockTrialStart,
    stop: mockTrialStop,
    reset: mockTrialReset,
  }),
}))

// Mock useEyeTracking
const mockEyeTrackingState = ref({
  initialized: false,
  monitoring: false,
  paused: false,
  pauseMessage: null as string | null,
})
const mockInitialize = vi.fn().mockRejectedValue(new Error('No camera'))
const mockStartMonitoring = vi.fn()
const mockStopMonitoring = vi.fn()
const mockDestroy = vi.fn()

vi.mock('~/composables/useEyeTracking', () => ({
  useEyeTracking: () => ({
    state: readonly(mockEyeTrackingState),
    initialize: mockInitialize,
    startMonitoring: mockStartMonitoring,
    stopMonitoring: mockStopMonitoring,
    destroy: mockDestroy,
  }),
}))

// Mock localStorage
const localStorageData: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key] }),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_ROUTE = '/modules/tnt/session?sessionId=tnt-session-123'

function makeCues(count: number): Cue[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `cue-${i}`,
    src: `/images/cue-${i}.svg`,
    name: `Cue ${i}`,
  }))
}

function storeCues(count = 6) {
  const cues = makeCues(count)
  localStorageData['tnt-cues'] = JSON.stringify(cues)
  return cues
}

async function mountAndStartTrials(route = SESSION_ROUTE) {
  const wrapper = await mountSuspended(TntSessionPage, { route })
  await wrapper.find('[data-testid="begin-trials-btn"]').trigger('click')
  await nextTick()
  return wrapper
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TNT Session Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockTrialStart.mockReset()
    mockTrialStop.mockReset()
    mockTrialReset.mockReset()
    mockInitialize.mockReset().mockRejectedValue(new Error('No camera'))
    mockStartMonitoring.mockReset()
    mockStopMonitoring.mockReset()
    mockDestroy.mockReset()
    mockTrialState = ref<TrialSequenceState>(createMockState())
    mockEyeTrackingState.value = {
      initialized: false,
      monitoring: false,
      paused: false,
      pauseMessage: null,
    }
    // Clear localStorage mock data
    Object.keys(localStorageData).forEach(k => delete localStorageData[k])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows instructions phase initially when cues are loaded', async () => {
    storeCues()
    const wrapper = await mountSuspended(TntSessionPage, { route: SESSION_ROUTE })

    expect(wrapper.text()).toContain('TNT Suppression Training')
    expect(wrapper.find('[data-testid="instructions-phase"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('How This Session Works')
    expect(wrapper.text()).toContain('Green border')
    expect(wrapper.text()).toContain('Think')
    expect(wrapper.text()).toContain('Red border')
    expect(wrapper.text()).toContain('No-Think')
  })

  it('transitions to running phase when user clicks start button', async () => {
    storeCues()
    const wrapper = await mountSuspended(TntSessionPage, { route: SESSION_ROUTE })

    await wrapper.find('[data-testid="begin-trials-btn"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="running-phase"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'TntTrialRunner' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'TntVigilanceTask' }).exists()).toBe(true)
  })

  it('passes cues from localStorage to TrialRunner', async () => {
    const cues = storeCues(8)
    const wrapper = await mountAndStartTrials()

    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    expect(runner.props('cues')).toEqual(cues)
  })

  it('shows eye tracking warning when initialization fails', async () => {
    storeCues()
    const wrapper = await mountSuspended(TntSessionPage, { route: SESSION_ROUTE })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="eye-tracking-warning"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('Eye tracking unavailable')
  })

  it('transitions to rating phase when trials complete', async () => {
    storeCues()
    const wrapper = await mountAndStartTrials()

    // Emit complete from TrialRunner
    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    runner.vm.$emit('complete', [
      { trialIndex: 0, cueId: 'cue-0', condition: 'think', itiMs: 800, reactionTimeMs: null, compliant: true },
      { trialIndex: 1, cueId: 'cue-1', condition: 'no-think', itiMs: 700, reactionTimeMs: null, compliant: true },
    ])
    await nextTick()

    expect(wrapper.find('[data-testid="rating-phase"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Session Complete')
    expect(wrapper.findComponent({ name: 'SharedSudsScale' }).exists()).toBe(true)
  })

  it('stops vigilance task and eye tracking when trials complete', async () => {
    storeCues()
    const wrapper = await mountAndStartTrials()

    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    runner.vm.$emit('complete', [])
    await nextTick()

    expect(mockStopMonitoring).toHaveBeenCalled()
  })

  it('displays session stats in the rating phase', async () => {
    storeCues()
    const wrapper = await mountAndStartTrials()

    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    runner.vm.$emit('complete', [
      { trialIndex: 0, cueId: 'cue-0', condition: 'think', itiMs: 800, reactionTimeMs: null, compliant: true },
      { trialIndex: 1, cueId: 'cue-1', condition: 'no-think', itiMs: 700, reactionTimeMs: 450, compliant: false },
      { trialIndex: 2, cueId: 'cue-2', condition: 'no-think', itiMs: 600, reactionTimeMs: null, compliant: true },
      { trialIndex: 3, cueId: 'cue-3', condition: 'think', itiMs: 900, reactionTimeMs: null, compliant: true },
    ])
    await nextTick()

    // Total trials
    expect(wrapper.find('[data-testid="stat-total"]').text()).toBe('4')
    // Compliance: 3/4 = 75%
    expect(wrapper.find('[data-testid="stat-compliance"]').text()).toBe('75%')
    // Avg reaction time: only one reaction (450ms)
    expect(wrapper.find('[data-testid="stat-reaction"]').text()).toBe('450ms')
    // Think / No-Think split
    expect(wrapper.find('[data-testid="stat-split"]').text()).toBe('2 / 2')
  })

  it('saves SUDs rating, TNT session data, and marks session complete', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    storeCues()
    const wrapper = await mountAndStartTrials()

    // Complete trials
    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    runner.vm.$emit('complete', [
      { trialIndex: 0, cueId: 'cue-0', condition: 'think', itiMs: 800, reactionTimeMs: null, compliant: true },
      { trialIndex: 1, cueId: 'cue-1', condition: 'no-think', itiMs: 700, reactionTimeMs: null, compliant: true },
    ])
    await nextTick()

    // Select a SUDs rating
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 5)

    // Wait for async operations
    await vi.waitFor(() => {
      // SUDs rating
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/tnt-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { suds: { rating: 5, phase: 'post-session' } },
        }),
      )
    })

    await vi.waitFor(() => {
      // TNT session data
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/tnt-session-123/tnt-data',
        expect.objectContaining({
          method: 'POST',
          body: {
            totalTrials: 2,
            thinkTrials: 1,
            noThinkTrials: 1,
            compliancePct: 100,
            avgReactionTimeMs: null,
          },
        }),
      )
    })

    await vi.waitFor(() => {
      // Mark complete
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/tnt-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { completed: true },
        }),
      )
    })
  })

  it('shows completion screen after saving', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    storeCues()
    const wrapper = await mountAndStartTrials()

    // Complete trials
    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    runner.vm.$emit('complete', [])
    await nextTick()

    // Submit rating
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 3)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="complete-phase"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('Session Saved')
    expect(wrapper.text()).toContain('View Progress')
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('shows error when saving fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ updated: true }) // SUDs succeeds
      .mockRejectedValueOnce({ data: { message: 'Server error' } }) // TNT data fails

    storeCues()
    const wrapper = await mountAndStartTrials()

    // Complete trials
    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    runner.vm.$emit('complete', [])
    await nextTick()

    // Submit rating
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 7)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })
  })

  it('accumulates trial logs from trialLogged events', async () => {
    storeCues()
    const wrapper = await mountAndStartTrials()

    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })

    // Emit individual trial logs
    runner.vm.$emit('trialLogged', {
      trialIndex: 0, cueId: 'cue-0', condition: 'think', itiMs: 800, reactionTimeMs: null, compliant: true,
    })
    await nextTick()

    runner.vm.$emit('trialLogged', {
      trialIndex: 1, cueId: 'cue-1', condition: 'no-think', itiMs: 700, reactionTimeMs: 320, compliant: false,
    })
    await nextTick()

    // Complete with full logs
    runner.vm.$emit('complete', [
      { trialIndex: 0, cueId: 'cue-0', condition: 'think', itiMs: 800, reactionTimeMs: null, compliant: true },
      { trialIndex: 1, cueId: 'cue-1', condition: 'no-think', itiMs: 700, reactionTimeMs: 320, compliant: false },
    ])
    await nextTick()

    // Verify stats are computed from the complete event's logs
    expect(wrapper.find('[data-testid="stat-total"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="stat-compliance"]').text()).toBe('50%')
  })

  it('shows gaze pause overlay when eye tracking is paused during running phase', async () => {
    storeCues()
    mockEyeTrackingState.value = {
      initialized: true,
      monitoring: true,
      paused: true,
      pauseMessage: 'Please look at the screen',
    }

    const wrapper = await mountAndStartTrials()

    expect(wrapper.find('[data-testid="gaze-pause-overlay"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Please look at the screen')
  })

  it('does not show gaze pause overlay in rating phase', async () => {
    storeCues()
    mockEyeTrackingState.value = {
      initialized: true,
      monitoring: true,
      paused: true,
      pauseMessage: 'Please look at the screen',
    }

    const wrapper = await mountAndStartTrials()

    // Transition to rating
    const runner = wrapper.findComponent({ name: 'TntTrialRunner' })
    runner.vm.$emit('complete', [])
    await nextTick()

    expect(wrapper.find('[data-testid="gaze-pause-overlay"]').exists()).toBe(false)
  })
})
