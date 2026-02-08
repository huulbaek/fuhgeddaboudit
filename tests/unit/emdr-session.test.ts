import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EmdrSessionPage from '../../app/pages/modules/emdr/session.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const SESSION_ROUTE = '/modules/emdr/session?sessionId=emdr-session-123'

describe('EMDR Session Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders with bilateral phase initially', async () => {
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })
    expect(wrapper.text()).toContain('EMDR Session')
    expect(wrapper.find('[data-testid="bilateral-phase"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'EmdrBilateralDot' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SharedTimerBar' }).exists()).toBe(true)
  })

  it('shows resource memory instruction for early sets', async () => {
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })
    expect(wrapper.text()).toContain('safe memory')
    expect(wrapper.text()).toContain('Set 1')
    expect(wrapper.text()).toContain('Resource')
  })

  it('transitions to check-in after timer completes', async () => {
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="checkin-phase"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('What do you notice?')
    expect(wrapper.find('[data-testid="checkin-input"]').exists()).toBe(true)
  })

  it('transitions from check-in to rating when Continue is clicked', async () => {
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete bilateral set
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Click continue in check-in
    await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="rating-phase"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SharedSudsScale' }).exists()).toBe(true)
  })

  it('starts next bilateral set after SUDs rating (normal flow)', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete set 1: bilateral -> check-in -> rating
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Submit a normal SUDs rating (not above threshold)
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 5)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="bilateral-phase"]').exists()).toBe(true)
    })

    // Should now be set 2
    expect(wrapper.text()).toContain('Set 2')
  })

  it('submits SUDs rating to the server with correct phase label', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete set 1
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
    await wrapper.vm.$nextTick()

    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 4)

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/emdr-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { suds: { rating: 4, phase: 'post-set-1' } },
        }),
      )
    })
  })

  it('transitions to target memory instructions after resource sets', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete 2 resource sets (RESOURCE_SETS = 2)
    for (let i = 0; i < 2; i++) {
      const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
      timer.vm.$emit('complete')
      await wrapper.vm.$nextTick()

      await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
      await wrapper.vm.$nextTick()

      const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
      sudsScale.vm.$emit('select', 3)

      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="bilateral-phase"]').exists()).toBe(true)
      })
    }

    // Set 3 should show target memory instruction
    expect(wrapper.text()).toContain('Set 3')
    expect(wrapper.text()).toContain('Target')
    expect(wrapper.text()).toContain('target memory')
  })

  it('triggers grounding when SUDs > 8 (abreaction monitor)', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete bilateral set
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Submit SUDs > 8 (abreaction threshold)
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 9)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="grounded-phase"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('Session Paused')
    expect(wrapper.text()).toContain('distress level was high')
  })

  it('aborts session on the server when abreaction triggers', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete bilateral set -> check-in -> rating
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
    await wrapper.vm.$nextTick()

    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 9)

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/emdr-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { aborted: true, abortReason: 'user_panic' },
        }),
      )
    })
  })

  it('allows ending session from check-in phase', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete bilateral set
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Click End Session during check-in
    await wrapper.find('[data-testid="end-session-btn"]').trigger('click')

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/emdr-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { completed: true },
        }),
      )
    })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="complete-phase"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('Session Complete')
  })

  it('allows ending session from rating phase', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete bilateral set -> check-in -> rating
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Click End Session Instead during rating
    await wrapper.find('[data-testid="end-session-rating-btn"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="complete-phase"]').exists()).toBe(true)
    })
  })

  it('shows sets completed count on completion screen', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete 1 set then end session
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="end-session-btn"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="complete-phase"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('1 set')
  })

  it('shows error when session save fails', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Network error' } })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete bilateral set
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="end-session-btn"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Network error')
    })
  })

  it('shows View Progress and Dashboard buttons on completion', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete set -> end session
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="end-session-btn"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="complete-phase"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('View Progress')
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('passes audio-enabled and speed props to BilateralDot', async () => {
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })
    const dot = wrapper.findComponent({ name: 'EmdrBilateralDot' })
    expect(dot.props('speedMs')).toBe(1000)
    expect(dot.props('audioEnabled')).toBe(true)
  })

  it('check-in response stays client-side (not sent to server)', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(EmdrSessionPage, { route: SESSION_ROUTE })

    // Complete bilateral set
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Type in check-in
    await wrapper.find('[data-testid="checkin-input"]').setValue('I feel lighter')
    await wrapper.find('[data-testid="checkin-continue"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Submit SUDs
    const sudsScale = wrapper.findComponent({ name: 'SharedSudsScale' })
    sudsScale.vm.$emit('select', 3)

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Verify no call body contains the check-in text
    for (const call of mockFetch.mock.calls) {
      if (call[1]?.body) {
        expect(JSON.stringify(call[1].body)).not.toContain('lighter')
      }
    }
  })
})
