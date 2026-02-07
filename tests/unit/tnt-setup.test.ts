import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TntSetupPage from '../../app/pages/modules/tnt/setup.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

/**
 * Helper: find the action button (Continue / Begin Session / Back).
 * Library buttons and Yes/No buttons are smaller; the action button is always last.
 */
function findActionButton(wrapper: any) {
  const buttons = wrapper.findAll('button')
  return buttons[buttons.length - 1]
}

/** Helper: select 6 library cues to meet the minimum */
async function selectMinimumCues(wrapper: any) {
  const libraryButtons = wrapper.findAll('.grid button')
  for (let i = 0; i < 6; i++) {
    await libraryButtons[i].trigger('click')
  }
  await wrapper.vm.$nextTick()
}

/** Helper: select 6 cues and proceed to association training */
async function goToTraining(wrapper: any) {
  await selectMinimumCues(wrapper)
  findActionButton(wrapper).trigger('click')
  await wrapper.vm.$nextTick()
}

/** Helper: confirm all cues trigger the memory in association training */
async function confirmAllCues(wrapper: any) {
  const cueCount = wrapper.vm.trainedCues.length
  for (let i = 0; i < cueCount; i++) {
    const yesBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Yes')
    if (yesBtn) {
      await yesBtn.trigger('click')
      await wrapper.vm.$nextTick()
    }
  }
}

describe('TNT Setup Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders with the cue selection phase active initially', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    expect(wrapper.text()).toContain('TNT Suppression Training')
    expect(wrapper.text()).toContain('Select Proxy Cues')
    expect(wrapper.text()).toContain('Image Library')
    expect(wrapper.findComponent({ name: 'SharedPhaseIndicator' }).exists()).toBe(true)
  })

  it('marks phase 1 as active and phase 2 as inactive initially', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    const steps = wrapper.findAll('span')
    const phase1 = steps.find((s: any) => s.text().includes('1. Cue Selection'))
    const phase2 = steps.find((s: any) => s.text().includes('2. Association Training'))
    expect(phase1?.classes()).toContain('text-primary')
    expect(phase2?.classes()).toContain('text-gray-400')
  })

  it('disables Continue button when fewer than 6 cues are selected', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('enables Continue button when 6 or more cues are selected', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    await selectMinimumCues(wrapper)

    const btn = findActionButton(wrapper)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('toggles library images on click (select and deselect)', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    const libraryButtons = wrapper.findAll('.grid button')

    // Select first cue
    await libraryButtons[0].trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('1/6 minimum')

    // Deselect it
    await libraryButtons[0].trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('1/6 minimum')
  })

  it('shows selected cues count', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    const libraryButtons = wrapper.findAll('.grid button')

    await libraryButtons[0].trigger('click')
    await libraryButtons[1].trigger('click')
    await libraryButtons[2].trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('3/6 minimum')
  })

  it('allows removing individual cues', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    const libraryButtons = wrapper.findAll('.grid button')

    await libraryButtons[0].trigger('click')
    await wrapper.vm.$nextTick()

    // Find the remove button (×)
    const removeBtn = wrapper.findAll('button').find((b: any) => b.text().includes('×'))
    expect(removeBtn).toBeDefined()
    await removeBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.cues.length).toBe(0)
  })

  it('transitions to association training phase after cue selection', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)

    expect(wrapper.text()).toContain('Association Training')
    expect(wrapper.text()).toContain('Does this cue trigger the target memory?')
    expect(wrapper.text()).toContain('Cue 1 of 6')

    const indicator = wrapper.findComponent({ name: 'SharedPhaseIndicator' })
    expect(indicator.props('label')).toBe('Association Training')
    expect(indicator.props('current')).toBe(2)
  })

  it('marks phase 1 as green when on phase 2', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)

    const steps = wrapper.findAll('span')
    const phase1 = steps.find((s: any) => s.text().includes('1. Cue Selection'))
    const phase2 = steps.find((s: any) => s.text().includes('2. Association Training'))
    expect(phase1?.classes()).toContain('text-green-600')
    expect(phase2?.classes()).toContain('text-primary')
  })

  it('advances through association training cues on Yes/No answers', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)

    // Answer Yes to first cue
    const yesBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Yes')
    await yesBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Cue 2 of 6')
  })

  it('shows training results after all cues are answered', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)
    await confirmAllCues(wrapper)

    expect(wrapper.text()).toContain('6 of 6 cues trigger the memory')
    expect(wrapper.text()).toContain('Ready to begin the session')
  })

  it('shows Begin Session button when training passes (≥6 confirmed cues)', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)
    await confirmAllCues(wrapper)

    const beginBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Begin Session')
    expect(beginBtn).toBeDefined()
  })

  it('shows failure message and Back button when fewer than 6 cues confirmed', async () => {
    const wrapper = await mountSuspended(TntSetupPage)

    // Select 7 cues
    const libraryButtons = wrapper.findAll('.grid button')
    for (let i = 0; i < 7; i++) {
      await libraryButtons[i].trigger('click')
    }
    await wrapper.vm.$nextTick()
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    // Answer Yes to only 3, No to rest
    for (let i = 0; i < 3; i++) {
      const yesBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Yes')
      await yesBtn!.trigger('click')
      await wrapper.vm.$nextTick()
    }
    for (let i = 0; i < 4; i++) {
      const noBtn = wrapper.findAll('button').find((b: any) => b.text() === 'No')
      if (noBtn) {
        await noBtn.trigger('click')
        await wrapper.vm.$nextTick()
      }
    }

    expect(wrapper.text()).toContain('3 of 7 cues trigger the memory')
    expect(wrapper.text()).toContain('need at least 6')

    const backBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Back to Cue Selection')
    expect(backBtn).toBeDefined()
  })

  it('navigates back to cue selection from failed training', async () => {
    const wrapper = await mountSuspended(TntSetupPage)

    // Select 7 cues
    const libraryButtons = wrapper.findAll('.grid button')
    for (let i = 0; i < 7; i++) {
      await libraryButtons[i].trigger('click')
    }
    await wrapper.vm.$nextTick()
    findActionButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    // Answer No to all
    for (let i = 0; i < 7; i++) {
      const noBtn = wrapper.findAll('button').find((b: any) => b.text() === 'No')
      if (noBtn) {
        await noBtn.trigger('click')
        await wrapper.vm.$nextTick()
      }
    }

    // Click Back button
    const backBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Back to Cue Selection')
    await backBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Select Proxy Cues')
  })

  it('creates a session with module tnt when Begin Session is clicked', async () => {
    mockFetch.mockResolvedValue({ id: 'tnt-session-1', module: 'tnt' })
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)
    await confirmAllCues(wrapper)

    const beginBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Begin Session')
    await beginBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
      method: 'POST',
      body: { module: 'tnt' },
    })
  })

  it('shows navigating state while creating session', async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve }))
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)
    await confirmAllCues(wrapper)

    const beginBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Begin Session')
    await beginBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Starting TNT session')

    resolveFetch!({ id: 'tnt-session-1', module: 'tnt' })
  })

  it('shows error and returns to training on session creation failure', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)
    await confirmAllCues(wrapper)

    const beginBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Begin Session')
    await beginBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })

    // Should return to association training phase
    expect(wrapper.text()).toContain('Association Training')
  })

  it('cue data is never sent to server', async () => {
    mockFetch.mockResolvedValue({ id: 'tnt-session-1', module: 'tnt' })
    const wrapper = await mountSuspended(TntSetupPage)
    await goToTraining(wrapper)
    await confirmAllCues(wrapper)

    const beginBtn = wrapper.findAll('button').find((b: any) => b.text() === 'Begin Session')
    await beginBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Verify the fetch call body does NOT contain cue data
    const callBody = mockFetch.mock.calls[0][1].body
    expect(callBody).not.toHaveProperty('cues')
    expect(callBody).not.toHaveProperty('trainedCues')
    expect(JSON.stringify(callBody)).not.toContain('Circle')
    expect(JSON.stringify(callBody)).not.toContain('Square')
  })

  it('displays the minimum cue requirement (6)', async () => {
    const wrapper = await mountSuspended(TntSetupPage)
    expect(wrapper.text()).toContain('at least 6')
  })
})
