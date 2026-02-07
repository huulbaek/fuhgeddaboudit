import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SudsRating from '../../app/components/rtm/SudsRating.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

function findSubmitButton(wrapper: any) {
  const buttons = wrapper.findAll('button')
  return buttons.find((b: any) => b.text() === 'Submit Rating')
}

function findButtonByText(wrapper: any, text: string) {
  const buttons = wrapper.findAll('button')
  return buttons.find((b: any) => b.text() === text)
}

describe('RTM SudsRating', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({})
    // Reset grounding state between tests
    const { isGrounding } = useGrounding()
    isGrounding.value = false
  })

  it('renders with SUDs scale and submit button', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    expect(wrapper.text()).toContain('Post-Loop Check — Set 1')
    expect(wrapper.findComponent({ name: 'SharedSudsScale' }).exists()).toBe(true)
    expect(findSubmitButton(wrapper)).toBeDefined()
  })

  it('disables submit button when no rating is selected', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const btn = findSubmitButton(wrapper)
    expect(btn?.attributes('disabled')).toBeDefined()
  })

  it('enables submit button after rating is selected', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 5)
    await wrapper.vm.$nextTick()

    const btn = findSubmitButton(wrapper)
    expect(btn?.attributes('disabled')).toBeUndefined()
  })

  it('shows success outcome when SUDs ≤ 3', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 2)
    await wrapper.vm.$nextTick()

    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="outcome-success"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('distress level has decreased')
    expect(findButtonByText(wrapper, 'End Session')).toBeDefined()
    expect(findButtonByText(wrapper, 'Another Set')).toBeDefined()
  })

  it('shows success for SUDs of exactly 3', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 3)
    await wrapper.vm.$nextTick()

    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="outcome-success"]').exists()).toBe(true)
  })

  it('shows repeat outcome when SUDs > 3', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 6)
    await wrapper.vm.$nextTick()

    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="outcome-repeat"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('still elevated')
    expect(findButtonByText(wrapper, 'Continue')).toBeDefined()
  })

  it('emits success event when End Session is clicked', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 1)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    findButtonByText(wrapper, 'End Session')!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('success')).toHaveLength(1)
    expect(wrapper.emitted('success')![0]).toEqual([1])
  })

  it('emits repeat event when Another Set is clicked after success', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 2)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    findButtonByText(wrapper, 'Another Set')!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('repeat')).toHaveLength(1)
    expect(wrapper.emitted('repeat')![0]).toEqual([2])
  })

  it('emits repeat event when Continue is clicked for repeat outcome', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 7)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    findButtonByText(wrapper, 'Continue')!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('repeat')).toHaveLength(1)
    expect(wrapper.emitted('repeat')![0]).toEqual([7])
  })

  it('shows repeat (not abort) on first unchanged rating', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: {
        sessionId: 'test-session',
        setNumber: 2,
        previousRating: 7,
      },
    })

    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 7)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    // First unchanged set (unchangedSets=1), should be repeat not abort
    expect(wrapper.find('[data-testid="outcome-repeat"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="outcome-abort"]').exists()).toBe(false)
  })

  it('aborts with grounding after 3 consecutive unchanged ratings', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: {
        sessionId: 'test-session',
        setNumber: 3,
        previousRating: 7,
      },
    })

    // Manually set unchangedSets to 2 to simulate 2 previous unchanged sets
    // @ts-expect-error accessing internal state for testing
    wrapper.vm.unchangedSets = 2
    await wrapper.vm.$nextTick()

    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 7) // Same as previousRating
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    // unchangedSets increments to 3, triggering abort
    expect(wrapper.find('[data-testid="outcome-abort"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('not changed after 3 sets')
  })

  it('triggers grounding and emits abort when abort OK is clicked', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: {
        sessionId: 'test-session',
        setNumber: 3,
        previousRating: 7,
      },
    })

    // Set up for abort
    // @ts-expect-error accessing internal state for testing
    wrapper.vm.unchangedSets = 2
    await wrapper.vm.$nextTick()

    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 7)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    findButtonByText(wrapper, 'OK')!.trigger('click')
    await wrapper.vm.$nextTick()

    // Grounding should be active (triggered by the component)
    const { isGrounding } = useGrounding()
    expect(isGrounding.value).toBe(true)

    // Grounding log should have been posted
    expect(mockFetch).toHaveBeenCalledWith('/api/grounding/log', {
      method: 'POST',
      body: { context: 'RTM abort: SUDs unchanged after 3 sets' },
    })

    // Abort event should be emitted
    expect(wrapper.emitted('abort')).toHaveLength(1)
    expect(wrapper.emitted('abort')![0]).toEqual(['SUDs unchanged after 3 full sets'])
  })

  it('disables SUDs scale after submission', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 5)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(suds.props('disabled')).toBe(true)
  })

  it('hides submit button after submission', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 5)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(findSubmitButton(wrapper)).toBeUndefined()
  })

  it('resets unchanged count when rating changes', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: {
        sessionId: 'test-session',
        setNumber: 2,
        previousRating: 7,
      },
    })

    // Set unchangedSets to 2 to simulate prior unchanged ratings
    // @ts-expect-error accessing internal state for testing
    wrapper.vm.unchangedSets = 2
    await wrapper.vm.$nextTick()

    // Submit a DIFFERENT rating (6 instead of 7)
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 6)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    // Should be repeat (not abort) because rating changed
    expect(wrapper.find('[data-testid="outcome-repeat"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="outcome-abort"]').exists()).toBe(false)
  })

  it('shows success for SUDs of 0', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 0)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="outcome-success"]').exists()).toBe(true)
  })

  it('shows repeat for SUDs of 4', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 1 },
    })
    const suds = wrapper.findComponent({ name: 'SharedSudsScale' })
    suds.vm.$emit('select', 4)
    await wrapper.vm.$nextTick()
    findSubmitButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="outcome-repeat"]').exists()).toBe(true)
  })

  it('displays correct set number from props', async () => {
    const wrapper = await mountSuspended(SudsRating, {
      props: { sessionId: 'test-session', setNumber: 4 },
    })
    expect(wrapper.text()).toContain('Post-Loop Check — Set 4')
  })
})
