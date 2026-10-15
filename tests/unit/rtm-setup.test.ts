import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RtmSetupPage from '../../app/pages/modules/rtm/setup.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

/**
 * Helper: find the Continue / action button (the last button in the current phase).
 * The SUDs scale renders 11 small rating buttons; the Continue button is the full-width one.
 */
function findActionButton(wrapper: any) {
  const buttons = wrapper.findAll('button')
  // The action button is always the last button rendered in the phase section
  return buttons[buttons.length - 1]
}

/** Helper to navigate from phase 1 → phase 2 (image labeling) */
async function goToImageLabeling(wrapper: any) {
  const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
  suds.vm.$emit('select', 6)
  await wrapper.vm.$nextTick()
  findActionButton(wrapper).trigger('click')
  await wrapper.vm.$nextTick()
}

/** Helper to navigate from phase 1 → phase 3 (narration) */
async function goToNarration(wrapper: any) {
  await goToImageLabeling(wrapper)
  await wrapper.find('#start-label').setValue('Before')
  await wrapper.find('#end-label').setValue('After')
  findActionButton(wrapper).trigger('click')
  await wrapper.vm.$nextTick()
}

/** Helper to navigate from phase 1 → phase 4 (dissociation check), skipping narration */
async function goToDissociationCheck(wrapper: any) {
  await goToNarration(wrapper)
  wrapper.findComponent({ name: 'RtmNarrationRecorder' }).vm.$emit('skip')
  await wrapper.vm.$nextTick()
}

describe('RTM Setup Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders with the SUDs baseline phase active initially', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    expect(wrapper.text()).toContain('RTM Rewind Protocol')
    expect(wrapper.text()).toContain('Baseline Distress Rating')
    expect(wrapper.findComponent({ name: 'SharedSudsScale' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SharedPhaseIndicator' }).exists()).toBe(true)
  })

  it('marks phase 1 as active and phases 2/3/4 as inactive initially', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    const steps = wrapper.findAll('span')
    const phase1 = steps.find((s: any) => s.text().includes('1. Baseline'))
    const phase2 = steps.find((s: any) => s.text().includes('2. Images'))
    const phase3 = steps.find((s: any) => s.text().includes('3. Narrate'))
    const phase4 = steps.find((s: any) => s.text().includes('4. Booth'))
    expect(phase1?.classes()).toContain('text-primary')
    expect(phase2?.classes()).toContain('text-gray-400')
    expect(phase3?.classes()).toContain('text-gray-400')
    expect(phase4?.classes()).toContain('text-gray-400')
  })

  it('disables Continue button when no SUDs rating is selected', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('enables Continue button after SUDs rating is selected', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 6)
    await wrapper.vm.$nextTick()

    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('transitions to image labeling phase after SUDs baseline', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToImageLabeling(wrapper)

    expect(wrapper.text()).toContain('Start & End Images')
    expect(wrapper.find('#start-label').exists()).toBe(true)
    expect(wrapper.find('#end-label').exists()).toBe(true)

    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Image Labeling')
    expect(indicator.props('current')).toBe(2)
  })

  it('disables Continue when image labels are empty', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToImageLabeling(wrapper)

    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('enables Continue when both image labels are filled', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToImageLabeling(wrapper)

    await wrapper.find('#start-label').setValue('Morning coffee')
    await wrapper.find('#end-label').setValue('Walking the dog')

    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('transitions to the narration phase after image labeling', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToNarration(wrapper)

    expect(wrapper.findComponent({ name: 'RtmNarrationRecorder' }).exists()).toBe(true)
    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Narration')
    expect(indicator.props('current')).toBe(3)
    expect(indicator.props('total')).toBe(4)
  })

  it('moves to the booth when narration is skipped', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToDissociationCheck(wrapper)

    expect(wrapper.text()).toContain('Enter the Projection Booth')
    expect(wrapper.text()).toContain('I am in the projection booth')

    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Projection Booth')
    expect(indicator.props('current')).toBe(4)
  })

  it('moves to the booth when narration is completed', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToNarration(wrapper)
    wrapper.findComponent({ name: 'RtmNarrationRecorder' }).vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Enter the Projection Booth')
  })

  it('shows projection booth imagery instructions', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToDissociationCheck(wrapper)

    expect(wrapper.text()).toContain('movie theater')
    expect(wrapper.text()).toContain('projection booth')
    expect(wrapper.text()).toContain('grayscale')
  })

  it('creates a session with baseline SUDs when booth is confirmed', async () => {
    mockFetch.mockResolvedValue({ id: 'rtm-session-1', module: 'rtm' })
    const wrapper = await mountSuspended(RtmSetupPage)

    // Phase 1 — select SUDs rating of 8
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 8)
    await wrapper.vm.$nextTick()
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    // Phase 2
    await wrapper.find('#start-label').setValue('Before')
    await wrapper.find('#end-label').setValue('After')
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    // Phase 3 — skip narration
    wrapper.findComponent({ name: 'RtmNarrationRecorder' }).vm.$emit('skip')
    await wrapper.vm.$nextTick()

    // Phase 4 — confirm booth
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
      method: 'POST',
      body: {
        module: 'rtm',
        suds: { rating: 8, phase: 'baseline' },
      },
    })
  })

  it('shows navigating state while creating session', async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToDissociationCheck(wrapper)

    // Confirm booth
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Starting RTM session')

    resolveFetch!({ id: 'rtm-session-1', module: 'rtm' })
  })

  it('shows error and returns to dissociation check on session creation failure', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToDissociationCheck(wrapper)

    // Confirm booth
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })

    // Should return to dissociation check phase
    expect(wrapper.text()).toContain('Enter the Projection Booth')
  })

  it('image labels are never sent to server', async () => {
    mockFetch.mockResolvedValue({ id: 'rtm-session-1', module: 'rtm' })
    const wrapper = await mountSuspended(RtmSetupPage)

    // Phase 1
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 6)
    await wrapper.vm.$nextTick()
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    // Phase 2 — fill in image labels
    await wrapper.find('#start-label').setValue('My secret safe place')
    await wrapper.find('#end-label').setValue('My recovery moment')
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    // Phase 3 — skip narration
    wrapper.findComponent({ name: 'RtmNarrationRecorder' }).vm.$emit('skip')
    await wrapper.vm.$nextTick()

    // Phase 4 — confirm booth
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    // Verify the fetch call body does NOT contain image labels
    const callBody = mockFetch.mock.calls[0][1].body
    expect(callBody).not.toHaveProperty('startLabel')
    expect(callBody).not.toHaveProperty('endLabel')
    expect(JSON.stringify(callBody)).not.toContain('My secret safe place')
    expect(JSON.stringify(callBody)).not.toContain('My recovery moment')
  })

  it('marks all previous phases as green when on later phases', async () => {
    const wrapper = await mountSuspended(RtmSetupPage)
    await goToDissociationCheck(wrapper)

    const steps = wrapper.findAll('span')
    const phase1 = steps.find((s: any) => s.text().includes('1. Baseline'))
    const phase2 = steps.find((s: any) => s.text().includes('2. Images'))
    const phase3 = steps.find((s: any) => s.text().includes('3. Narrate'))
    const phase4 = steps.find((s: any) => s.text().includes('4. Booth'))
    expect(phase1?.classes()).toContain('text-green-600')
    expect(phase2?.classes()).toContain('text-green-600')
    expect(phase3?.classes()).toContain('text-green-600')
    expect(phase4?.classes()).toContain('text-primary')
  })
})
