import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TetrisSetupPage from '../../app/pages/modules/tetris/setup.vue'

// Mock $fetch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('Tetris Setup Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders with the reactivation phase active initially', async () => {
    const wrapper = await mountSuspended(TetrisSetupPage)
    expect(wrapper.text()).toContain('Visuospatial Interference')
    expect(wrapper.text()).toContain('Phase 1: Reactivation')
    expect(wrapper.text()).toContain('Phase 2: Wait Period')
    expect(wrapper.text()).toContain('Guided Memory Focus')
    expect(wrapper.findComponent({ name: 'SharedPhaseIndicator' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SharedTimerBar' }).exists()).toBe(true)
  })

  it('marks Phase 1 as active and Phase 2 as inactive initially', async () => {
    const wrapper = await mountSuspended(TetrisSetupPage)
    const steps = wrapper.findAll('span')
    const phase1 = steps.find(s => s.text().includes('Phase 1'))
    const phase2 = steps.find(s => s.text().includes('Phase 2'))
    expect(phase1?.classes()).toContain('text-primary')
    expect(phase2?.classes()).toContain('text-gray-400')
  })

  it('shows PhaseIndicator with label "Reactivation" and current 1 of 2', async () => {
    const wrapper = await mountSuspended(TetrisSetupPage)
    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Reactivation')
    expect(indicator.props('current')).toBe(1)
    expect(indicator.props('total')).toBe(2)
  })

  it('transitions to wait phase when reactivation timer completes', async () => {
    const wrapper = await mountSuspended(TetrisSetupPage)

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()
    // Allow nextTick inside handler
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Settling Period')
    expect(wrapper.text()).toContain('Breathe')
    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Wait Period')
    expect(indicator.props('current')).toBe(2)
    expect(indicator.props('total')).toBe(2)
  })

  it('marks Phase 1 as completed and Phase 2 as active after transition', async () => {
    const wrapper = await mountSuspended(TetrisSetupPage)

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const steps = wrapper.findAll('span')
    const phase1 = steps.find(s => s.text().includes('Phase 1'))
    const phase2 = steps.find(s => s.text().includes('Phase 2'))
    expect(phase1?.classes()).toContain('text-green-600')
    expect(phase2?.classes()).toContain('text-primary')
  })

  it('creates a session and navigates when wait timer completes', async () => {
    mockFetch.mockResolvedValue({ id: 'test-session-id', module: 'tetris' })
    const wrapper = await mountSuspended(TetrisSetupPage)

    // Transition to wait phase
    const timer1 = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer1.vm.$emit('complete')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Complete wait phase
    const timer2 = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer2.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
      method: 'POST',
      body: { module: 'tetris' },
    })
  })

  it('shows navigating state while creating session', async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))
    const wrapper = await mountSuspended(TetrisSetupPage)

    // Transition to wait phase
    const timer1 = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer1.vm.$emit('complete')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Complete wait phase
    const timer2 = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer2.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Starting game session')

    resolveFetch!({ id: 'test-session-id', module: 'tetris' })
  })

  it('shows error and returns to wait phase when session creation fails', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(TetrisSetupPage)

    // Transition to wait phase
    const timer1 = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer1.vm.$emit('complete')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Complete wait phase
    const timer2 = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer2.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })

    // Should return to wait phase
    expect(wrapper.text()).toContain('Settling Period')
  })

  it('shows breathing pacer during wait phase', async () => {
    const wrapper = await mountSuspended(TetrisSetupPage)

    // No breathing pacer during reactivation
    expect(wrapper.text()).not.toContain('Breathe in')
    expect(wrapper.text()).not.toContain('Breathe out')

    // Transition to wait phase
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Breathing pacer should appear (starts at 0ms elapsed which maps to "Breathe in...")
    const breathCircle = wrapper.find('.rounded-full.bg-emerald-200')
    expect(breathCircle.exists()).toBe(true)
  })
})
