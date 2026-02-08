import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ResourceInstall from '../../app/components/emdr/ResourceInstall.vue'

// Mock AudioContext so BilateralDot doesn't fail
function createMockAudioNode() {
  return {
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
    gain: { value: 1 },
    pan: { value: 0 },
  }
}

beforeEach(() => {
  const mockCtx = {
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    destination: {},
    createOscillator: vi.fn(() => createMockAudioNode()),
    createGain: vi.fn(() => createMockAudioNode()),
    createStereoPanner: vi.fn(() => createMockAudioNode()),
  }
  globalThis.AudioContext = vi.fn(() => mockCtx) as any
})

afterEach(() => {
  delete (globalThis as any).AudioContext
  vi.restoreAllMocks()
})

function findButton(wrapper: any, testId: string) {
  return wrapper.find(`[data-testid="${testId}"]`)
}

function findStepButton(wrapper: any) {
  return findButton(wrapper, 'step-button')
}

/** Advance through all intro guided steps */
async function completeIntroSteps(wrapper: any) {
  // There are 3 steps; click through all of them
  for (let i = 0; i < 3; i++) {
    await findStepButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()
  }
}

describe('ResourceInstall', () => {
  it('renders with intro phase showing first guided step', async () => {
    const wrapper = await mountSuspended(ResourceInstall)

    expect(wrapper.text()).toContain('Resource Installation')
    expect(wrapper.text()).toContain('Step 1 of 3')
    expect(wrapper.text()).toContain('Close your eyes and breathe')
  })

  it('advances through guided steps on button click', async () => {
    const wrapper = await mountSuspended(ResourceInstall)

    expect(wrapper.text()).toContain('Step 1 of 3')

    await findStepButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Step 2 of 3')
    expect(wrapper.text()).toContain('Bring your safe memory to mind')

    await findStepButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Step 3 of 3')
    expect(wrapper.text()).toContain('Strengthen the image')
  })

  it('shows "Begin Bilateral Tapping" on last step', async () => {
    const wrapper = await mountSuspended(ResourceInstall)

    // First step shows Continue
    expect(findStepButton(wrapper).text()).toBe('Continue')

    // Advance to step 2
    await findStepButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()
    expect(findStepButton(wrapper).text()).toBe('Continue')

    // Advance to step 3
    await findStepButton(wrapper).trigger('click')
    await wrapper.vm.$nextTick()
    expect(findStepButton(wrapper).text()).toBe('Begin Bilateral Tapping')
  })

  it('transitions to bilateral phase after completing all steps', async () => {
    const wrapper = await mountSuspended(ResourceInstall)
    await completeIntroSteps(wrapper)

    expect(wrapper.text()).toContain('Follow the dot with your eyes')
    expect(wrapper.findComponent({ name: 'EmdrBilateralDot' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'SharedTimerBar' }).exists()).toBe(true)
  })

  it('shows completion state when timer finishes', async () => {
    const wrapper = await mountSuspended(ResourceInstall)
    await completeIntroSteps(wrapper)

    // Simulate the timer completing
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Resource Installed')
    expect(wrapper.text()).toContain('Continue to Session')
  })

  it('emits complete event when finish button is clicked', async () => {
    const wrapper = await mountSuspended(ResourceInstall)
    await completeIntroSteps(wrapper)

    // Complete the timer
    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    timer.vm.$emit('complete')
    await wrapper.vm.$nextTick()

    // Click the finish button
    await findButton(wrapper, 'finish-button').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('accepts a custom durationMs prop', async () => {
    const wrapper = await mountSuspended(ResourceInstall, {
      props: { durationMs: 15000 },
    })
    await completeIntroSteps(wrapper)

    const timer = wrapper.findComponent({ name: 'SharedTimerBar' })
    expect(timer.props('durationMs')).toBe(15000)
  })

  it('does not show bilateral dot during intro phase', async () => {
    const wrapper = await mountSuspended(ResourceInstall)

    expect(wrapper.findComponent({ name: 'EmdrBilateralDot' }).exists()).toBe(false)
  })

  it('does not show finish button during bilateral phase', async () => {
    const wrapper = await mountSuspended(ResourceInstall)
    await completeIntroSteps(wrapper)

    expect(findButton(wrapper, 'finish-button').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Resource Installed')
  })
})
