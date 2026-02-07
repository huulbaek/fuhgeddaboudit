import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PanicButton from '../../app/components/grounding/PanicButton.vue'

describe('PanicButton', () => {
  it('renders a button with the correct aria-label', async () => {
    const wrapper = await mountSuspended(PanicButton)
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-label')).toBe('Grounding — I need to feel safe')
  })

  it('calls useGrounding().trigger() with "panic-button" on click', async () => {
    const wrapper = await mountSuspended(PanicButton)
    const button = wrapper.find('button')
    await button.trigger('click')

    // After clicking, grounding should be active
    const { isGrounding } = useGrounding()
    expect(isGrounding.value).toBe(true)
  })

  it('has fixed positioning classes', async () => {
    const wrapper = await mountSuspended(PanicButton)
    const button = wrapper.find('button')
    expect(button.classes()).toContain('fixed')
    expect(button.classes()).toContain('z-50')
  })
})
