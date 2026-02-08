import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EmdrSetupPage from '../../app/pages/modules/emdr/setup.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

function findActionButton(wrapper: any) {
  const buttons = wrapper.findAll('button')
  return buttons[buttons.length - 1]
}

/** Helper to advance from device check to resource installation */
async function goToResourceInstall(wrapper: any) {
  findActionButton(wrapper).trigger('click')
  await wrapper.vm.$nextTick()
}

/** Helper to advance from device check through resource installation to breathing */
async function goToBreathing(wrapper: any) {
  await goToResourceInstall(wrapper)
  await wrapper.find('#safe-memory').setValue('My safe place by the lake')
  findActionButton(wrapper).trigger('click')
  await wrapper.vm.$nextTick()
  await wrapper.vm.$nextTick()
}

describe('EMDR Setup Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    // Default to wide screen
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  })

  it('renders with the device check phase active initially', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    expect(wrapper.text()).toContain('EMDR Protocol')
    expect(wrapper.text()).toContain('Device Check')
    expect(wrapper.findComponent({ name: 'SharedPhaseIndicator' }).exists()).toBe(true)
  })

  it('marks phase 1 as active and phases 2/3 as inactive initially', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    const steps = wrapper.findAll('span')
    const phase1 = steps.find((s: any) => s.text().includes('1. Device'))
    const phase2 = steps.find((s: any) => s.text().includes('2. Resource'))
    const phase3 = steps.find((s: any) => s.text().includes('3. Breathing'))
    expect(phase1?.classes()).toContain('text-primary')
    expect(phase2?.classes()).toContain('text-gray-400')
    expect(phase3?.classes()).toContain('text-gray-400')
  })

  it('shows screen-width-sufficient message on wide screens', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    const wrapper = await mountSuspended(EmdrSetupPage)
    expect(wrapper.text()).toContain('sufficient')
    expect(wrapper.text()).not.toContain('narrower than 768px')
  })

  it('shows small screen warning when width < 768px', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 600, writable: true })
    const wrapper = await mountSuspended(EmdrSetupPage)
    expect(wrapper.text()).toContain('narrower than 768px')
    const btn = findActionButton(wrapper)
    expect(btn.text()).toContain('Continue anyway')
  })

  it('transitions to resource installation after device check', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToResourceInstall(wrapper)

    expect(wrapper.text()).toContain('Safe Memory Resource')
    expect(wrapper.find('#safe-memory').exists()).toBe(true)

    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Resource Installation')
    expect(indicator.props('current')).toBe(2)
  })

  it('disables Continue when safe memory description is empty', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToResourceInstall(wrapper)

    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('enables Continue when safe memory is filled', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToResourceInstall(wrapper)

    await wrapper.find('#safe-memory').setValue('My safe place')

    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('transitions to breathing phase after resource installation', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToBreathing(wrapper)

    expect(wrapper.text()).toContain('Breathing Stabilization')

    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Breathing')
    expect(indicator.props('current')).toBe(3)
  })

  it('shows breathing pacer during breathing phase', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToBreathing(wrapper)

    const breathCircle = wrapper.find('.rounded-full.bg-emerald-200')
    expect(breathCircle.exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SharedTimerBar' }).exists()).toBe(true)
  })

  it('creates a session when breathing timer completes', async () => {
    mockFetch.mockResolvedValue({ id: 'emdr-session-1', module: 'emdr' })
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToBreathing(wrapper)

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
      method: 'POST',
      body: { module: 'emdr' },
    })
  })

  it('shows navigating state while creating session', async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToBreathing(wrapper)

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Starting EMDR session')

    resolveFetch!({ id: 'emdr-session-1', module: 'emdr' })
  })

  it('shows error and returns to breathing phase on session creation failure', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToBreathing(wrapper)

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })

    expect(wrapper.text()).toContain('Breathing Stabilization')
  })

  it('safe memory description is never sent to server', async () => {
    mockFetch.mockResolvedValue({ id: 'emdr-session-1', module: 'emdr' })
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToBreathing(wrapper)

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    const callBody = mockFetch.mock.calls[0][1].body
    expect(JSON.stringify(callBody)).not.toContain('safe place')
    expect(JSON.stringify(callBody)).not.toContain('lake')
    expect(callBody).not.toHaveProperty('safeMemory')
  })

  it('marks all previous phases as green when on later phases', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToBreathing(wrapper)

    const steps = wrapper.findAll('span')
    const phase1 = steps.find((s: any) => s.text().includes('1. Device'))
    const phase2 = steps.find((s: any) => s.text().includes('2. Resource'))
    const phase3 = steps.find((s: any) => s.text().includes('3. Breathing'))
    expect(phase1?.classes()).toContain('text-green-600')
    expect(phase2?.classes()).toContain('text-green-600')
    expect(phase3?.classes()).toContain('text-primary')
  })

  it('shows privacy notice in resource installation phase', async () => {
    const wrapper = await mountSuspended(EmdrSetupPage)
    await goToResourceInstall(wrapper)

    expect(wrapper.text()).toContain('never sent to our servers')
  })
})
