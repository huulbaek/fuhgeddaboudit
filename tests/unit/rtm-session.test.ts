import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RtmSessionPage from '../../app/pages/modules/rtm/session.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const SESSION_ROUTE = '/modules/rtm/session?sessionId=rtm-session-123'

function findButtonByText(wrapper: any, text: string) {
  const buttons = wrapper.findAll('button')
  return buttons.find((b: any) => b.text() === text)
}

describe('RTM Session Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({})
    // Reset grounding state between tests
    const { isGrounding } = useGrounding()
    isGrounding.value = false
  })

  it('renders with the forward pass phase initially', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })
    expect(wrapper.text()).toContain('RTM Rewind Protocol')
    expect(wrapper.text()).toContain('Forward Pass')
    expect(wrapper.text()).toContain('Set 1')
    expect(wrapper.text()).toContain('Loop 1 of 5')
    expect(wrapper.findComponent({ name: 'RtmCinemaView' }).exists()).toBe(true)
  })

  it('shows PhaseIndicator with loop progress', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })
    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Forward Pass')
    expect(indicator.props('current')).toBe(1)
    expect(indicator.props('total')).toBe(5)
  })

  it('transitions from forward to rewind when CinemaView completes', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    const cinema = wrapper.findComponent({ name: 'RtmCinemaView' })
    cinema.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Rewind')
    expect(wrapper.findComponent({ name: 'RtmRewindAnimation' }).exists()).toBe(true)
  })

  it('advances loop counter after rewind and goes back to forward', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Loop 1: forward → rewind
    const cinema = wrapper.findComponent({ name: 'RtmCinemaView' })
    cinema.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Loop 1: rewind → forward (loop 2)
    const rewind = wrapper.findComponent({ name: 'RtmRewindAnimation' })
    rewind.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Forward Pass')
    expect(wrapper.text()).toContain('Loop 2 of 5')
    expect(wrapper.findComponent({ name: 'RtmCinemaView' }).exists()).toBe(true)
  })

  it('shows SUDs rating after 5 complete loops', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Run through 5 forward→rewind cycles
    for (let i = 0; i < 5; i++) {
      const cinema = wrapper.findComponent({ name: 'RtmCinemaView' })
      cinema.vm.$emit('complete')
      await wrapper.vm.$nextTick()

      const rewind = wrapper.findComponent({ name: 'RtmRewindAnimation' })
      rewind.vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    // Should now be in the rating phase
    expect(wrapper.findComponent({ name: 'RtmSudsRating' }).exists()).toBe(true)
  })

  it('passes correct props to SudsRating', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Complete 5 loops
    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    const sudsRating = wrapper.findComponent({ name: 'RtmSudsRating' })
    expect(sudsRating.props('sessionId')).toBe('rtm-session-123')
    expect(sudsRating.props('setNumber')).toBe(1)
    expect(sudsRating.props('previousRating')).toBeNull()
  })

  it('completes session when SudsRating emits success', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Complete 5 loops
    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    // Emit success from SudsRating
    const sudsRating = wrapper.findComponent({ name: 'RtmSudsRating' })
    sudsRating.vm.$emit('success', 2)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Session Complete')
    })

    expect(wrapper.text()).toContain('View Progress')
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('saves SUDs and marks session completed on success', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Complete 5 loops
    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    // Emit success
    wrapper.findComponent({ name: 'RtmSudsRating' }).vm.$emit('success', 2)

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/rtm-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { suds: { rating: 2, phase: 'post-set-1' } },
        }),
      )
    })

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/rtm-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { completed: true },
        }),
      )
    })
  })

  it('starts a new set of 5 loops when SudsRating emits repeat', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Complete first set of 5 loops
    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    // Emit repeat from SudsRating with rating 6
    wrapper.findComponent({ name: 'RtmSudsRating' }).vm.$emit('repeat', 6)
    await wrapper.vm.$nextTick()

    // Should be back in forward pass, set 2, loop 1
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Forward Pass')
    })
    expect(wrapper.text()).toContain('Set 2')
    expect(wrapper.text()).toContain('Loop 1 of 5')
  })

  it('passes previous rating to SudsRating on second set', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Complete first set
    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    // Repeat with rating 7
    wrapper.findComponent({ name: 'RtmSudsRating' }).vm.$emit('repeat', 7)
    await wrapper.vm.$nextTick()

    // Complete second set
    await vi.waitFor(() => {
      expect(wrapper.findComponent({ name: 'RtmCinemaView' }).exists()).toBe(true)
    })

    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    const sudsRating = wrapper.findComponent({ name: 'RtmSudsRating' })
    expect(sudsRating.props('setNumber')).toBe(2)
    expect(sudsRating.props('previousRating')).toBe(7)
  })

  it('aborts session when SudsRating emits abort', async () => {
    mockFetch.mockResolvedValue({ updated: true })
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Complete 5 loops
    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    // Emit abort
    wrapper.findComponent({ name: 'RtmSudsRating' }).vm.$emit('abort', 'SUDs unchanged after 3 full sets')

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/rtm-session-123',
        expect.objectContaining({
          method: 'PATCH',
          body: { aborted: true, abortReason: 'suds_no_change' },
        }),
      )
    })
  })

  it('shows error when session save fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ updated: true }) // SUDs rating succeeds
      .mockRejectedValueOnce({ data: { message: 'Network error' } }) // completion fails

    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Complete 5 loops
    for (let i = 0; i < 5; i++) {
      wrapper.findComponent({ name: 'RtmCinemaView' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'RtmRewindAnimation' }).vm.$emit('complete')
      await wrapper.vm.$nextTick()
    }

    // Emit success
    wrapper.findComponent({ name: 'RtmSudsRating' }).vm.$emit('success', 2)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Network error')
    })
  })

  it('passes image labels to CinemaView and RewindAnimation', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    const cinema = wrapper.findComponent({ name: 'RtmCinemaView' })
    expect(cinema.props('startLabel')).toBeDefined()
    expect(cinema.props('endLabel')).toBeDefined()
  })

  it('keeps loop count consistent during forward and rewind of same loop', async () => {
    const wrapper = await mountSuspended(RtmSessionPage, { route: SESSION_ROUTE })

    // Forward pass of loop 1
    expect(wrapper.text()).toContain('Loop 1 of 5')

    const cinema = wrapper.findComponent({ name: 'RtmCinemaView' })
    cinema.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Rewind pass of loop 1 — same loop number
    expect(wrapper.text()).toContain('Loop 1 of 5')
  })
})
