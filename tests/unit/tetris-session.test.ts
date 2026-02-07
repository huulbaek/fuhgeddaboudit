import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TetrisSessionPage from '../../app/pages/modules/tetris/session.vue'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)


const SESSION_ROUTE = '/modules/tetris/session?sessionId=test-session-123'

describe('Tetris Session Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders with the playing phase initially', async () => {
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })
    expect(wrapper.text()).toContain('Visuospatial Interference')
    expect(wrapper.text()).toContain('Game Session')
    expect(wrapper.findComponent({ name: 'SharedTimerBar' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'TetrisGameBoard' }).exists()).toBe(true)
  })

  it('shows PhaseIndicator with label "Game Session" and current 1 of 2', async () => {
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })
    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Game Session')
    expect(indicator.props('current')).toBe(1)
    expect(indicator.props('total')).toBe(2)
  })

  it('transitions to rating phase when timer completes', async () => {
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Session Complete')
    expect(wrapper.text()).toContain('Post-Session Rating')
    expect(wrapper.findComponent({ name: 'SharedSudsScale' }).exists()).toBe(true)
  })

  it('transitions to rating phase when game over is emitted', async () => {
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })

    const board = wrapper.findComponent({ name: 'TetrisGameBoard' })
    board.vm.$emit('gameOver', { score: 1500, linesCleared: 12 })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Session Complete')
    expect(wrapper.text()).toContain('1500')
    expect(wrapper.text()).toContain('12')
  })

  it('shows final stats in the rating phase', async () => {
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })

    const board = wrapper.findComponent({ name: 'TetrisGameBoard' })
    board.vm.$emit('gameOver', { score: 2000, linesCleared: 15 })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Score')
    expect(wrapper.text()).toContain('2000')
    expect(wrapper.text()).toContain('Lines')
    expect(wrapper.text()).toContain('15')
    expect(wrapper.text()).toContain('Difficulty Adjustments')
  })

  it('saves SUDs rating and marks session complete', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })

    // Transition to rating phase
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Select a SUDs rating
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 4)
    await wrapper.vm.$nextTick()

    // Wait for async operations
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/test-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { suds: { rating: 4, phase: 'post-session' } },
        }),
      )
    })

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/test-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { completed: true },
        }),
      )
    })
  })

  it('shows completion screen after saving', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })

    // Transition to rating phase
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Submit rating
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 3)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Session Saved')
    })

    expect(wrapper.text()).toContain('View Progress')
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('shows error when saving fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ updated: true }) // SUDs rating succeeds
      .mockRejectedValueOnce({ data: { message: 'Network error' } }) // completion fails

    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })

    // Transition to rating phase
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Submit rating
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 5)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Network error')
    })
  })

  it('passes adaptive difficulty gravity to GameBoard', async () => {
    const wrapper = await mountSuspended(TetrisSessionPage, { route: SESSION_ROUTE })
    const board = wrapper.findComponent({ name: 'TetrisGameBoard' })
    // Default initial gravity from useAdaptiveDifficulty is 600ms
    expect(board.props('gravityMs')).toBe(600)
  })

})
