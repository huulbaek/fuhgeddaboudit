import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PhaseIndicator from '../../app/components/shared/PhaseIndicator.vue'

describe('PhaseIndicator', () => {
  it('renders the phase label and progress', async () => {
    const wrapper = await mountSuspended(PhaseIndicator, {
      props: { label: 'Forward Pass', current: 3, total: 5 },
    })
    expect(wrapper.text()).toContain('Forward Pass')
    expect(wrapper.text()).toContain('3/5')
  })

  it('updates when props change', async () => {
    const wrapper = await mountSuspended(PhaseIndicator, {
      props: { label: 'Rewind', current: 1, total: 5 },
    })
    expect(wrapper.text()).toContain('Rewind')
    expect(wrapper.text()).toContain('1/5')

    await wrapper.setProps({ current: 4 })
    expect(wrapper.text()).toContain('4/5')
  })

  it('has correct aria-label for accessibility', async () => {
    const wrapper = await mountSuspended(PhaseIndicator, {
      props: { label: 'Set', current: 2, total: 3 },
    })
    const el = wrapper.find('[role="status"]')
    expect(el.exists()).toBe(true)
    expect(el.attributes('aria-label')).toBe('Set 2 of 3')
  })

  it('renders with role=status for screen readers', async () => {
    const wrapper = await mountSuspended(PhaseIndicator, {
      props: { label: 'Trial', current: 1, total: 12 },
    })
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('renders correctly at boundary values', async () => {
    const wrapper = await mountSuspended(PhaseIndicator, {
      props: { label: 'Loop', current: 5, total: 5 },
    })
    expect(wrapper.text()).toContain('5/5')
  })
})
