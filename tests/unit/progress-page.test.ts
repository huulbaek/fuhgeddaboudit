import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProgressPage from '../../app/pages/progress/index.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

function makeProgressData(overrides: Record<string, unknown> = {}) {
  return {
    sessionCount: 5,
    completedCount: 3,
    abortedCount: 1,
    currentStreak: 2,
    sudsTrend: [
      { sessionId: 's1', module: 'tetris', date: '2026-01-10T10:00:00Z', preRating: 7, postRating: 4 },
      { sessionId: 's2', module: 'rtm', date: '2026-01-12T10:00:00Z', preRating: 6, postRating: 3 },
    ],
    sessionHistory: [
      { id: 's1', module: 'tetris', startedAt: '2026-01-10T10:00:00Z', endedAt: '2026-01-10T10:20:00Z', completed: true, aborted: false, abortReason: null },
      { id: 's2', module: 'rtm', startedAt: '2026-01-12T10:00:00Z', endedAt: '2026-01-12T10:15:00Z', completed: true, aborted: false, abortReason: null },
      { id: 's3', module: 'tnt', startedAt: '2026-01-14T10:00:00Z', endedAt: '2026-01-14T10:05:00Z', completed: false, aborted: true, abortReason: 'grounding triggered' },
    ],
    moduleStats: {},
    ...overrides,
  }
}

describe('Progress Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('shows loading state initially', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const wrapper = await mountSuspended(ProgressPage)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('shows error when fetch fails', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Unauthorized' } })
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('Unauthorized')
  })

  it('displays summary stats', async () => {
    mockFetch.mockResolvedValue(makeProgressData())
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="stats"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="session-count"]').text()).toBe('5')
    expect(wrapper.find('[data-testid="completed-count"]').text()).toBe('3')
    expect(wrapper.find('[data-testid="aborted-count"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="streak"]').text()).toBe('2')
  })

  it('renders SUDs trend chart with pre and post lines', async () => {
    mockFetch.mockResolvedValue(makeProgressData())
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="suds-chart"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="pre-line"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="post-line"]').exists()).toBe(true)
  })

  it('shows empty chart message when no SUDs data', async () => {
    mockFetch.mockResolvedValue(makeProgressData({ sudsTrend: [] }))
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="suds-chart"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('No SUDs data yet')
  })

  it('renders session history with completion badges', async () => {
    mockFetch.mockResolvedValue(makeProgressData())
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="session-history"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('Tetris')
    expect(wrapper.text()).toContain('RTM')
    expect(wrapper.text()).toContain('TNT')

    const completedBadges = wrapper.findAll('[data-testid="badge-completed"]')
    expect(completedBadges.length).toBe(2)

    const abortedBadges = wrapper.findAll('[data-testid="badge-aborted"]')
    expect(abortedBadges.length).toBe(1)
  })

  it('shows empty history message when no sessions', async () => {
    mockFetch.mockResolvedValue(makeProgressData({ sessionHistory: [] }))
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="session-history"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('No sessions yet')
  })

  it('renders module-specific stats cards', async () => {
    mockFetch.mockResolvedValue(makeProgressData({
      moduleStats: {
        tetris: { completedSessions: 4 },
        rtm: { completedSessions: 2, avgLoopsToTarget: 3.5 },
        tnt: { completedSessions: 3, avgCompliancePct: 85.5 },
        emdr: { completedSessions: 1 },
      },
    }))
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="module-stats"]').exists()).toBe(true)
    })

    // Tetris card
    const tetrisCard = wrapper.find('[data-testid="stat-tetris"]')
    expect(tetrisCard.exists()).toBe(true)
    expect(tetrisCard.text()).toContain('4')
    expect(tetrisCard.text()).toContain('sessions completed')

    // RTM card
    const rtmCard = wrapper.find('[data-testid="stat-rtm"]')
    expect(rtmCard.exists()).toBe(true)
    expect(rtmCard.text()).toContain('3.5')
    expect(rtmCard.text()).toContain('avg loops to target')

    // TNT card
    const tntCard = wrapper.find('[data-testid="stat-tnt"]')
    expect(tntCard.exists()).toBe(true)
    expect(tntCard.text()).toContain('86%')
    expect(tntCard.text()).toContain('avg compliance')

    // EMDR card
    const emdrCard = wrapper.find('[data-testid="stat-emdr"]')
    expect(emdrCard.exists()).toBe(true)
    expect(emdrCard.text()).toContain('1')
    expect(emdrCard.text()).toContain('sessions completed')
  })

  it('hides module stats section when no module stats exist', async () => {
    mockFetch.mockResolvedValue(makeProgressData({ moduleStats: {} }))
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="stats"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="module-stats"]').exists()).toBe(false)
  })

  it('shows only cards for modules with data', async () => {
    mockFetch.mockResolvedValue(makeProgressData({
      moduleStats: {
        tetris: { completedSessions: 2 },
      },
    }))
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="module-stats"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="stat-tetris"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stat-rtm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="stat-tnt"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="stat-emdr"]').exists()).toBe(false)
  })

  it('handles SUDs data with only pre ratings', async () => {
    mockFetch.mockResolvedValue(makeProgressData({
      sudsTrend: [
        { sessionId: 's1', module: 'tetris', date: '2026-01-10T10:00:00Z', preRating: 7, postRating: null },
      ],
    }))
    const wrapper = await mountSuspended(ProgressPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="suds-chart"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="pre-line"]').exists()).toBe(true)
  })
})
