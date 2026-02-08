import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CrisisFooter from '../../app/components/shared/CrisisFooter.vue'

describe('CrisisFooter', () => {
  it('renders a footer element with data-testid', async () => {
    const wrapper = await mountSuspended(CrisisFooter)
    const footer = wrapper.find('[data-testid="crisis-footer"]')
    expect(footer.exists()).toBe(true)
    expect(footer.element.tagName).toBe('FOOTER')
  })

  it('displays 988 Suicide & Crisis Lifeline info', async () => {
    const wrapper = await mountSuspended(CrisisFooter)
    const text = wrapper.text()
    expect(text).toContain('988 Suicide & Crisis Lifeline')
    expect(text).toContain('988')
  })

  it('displays Crisis Text Line info', async () => {
    const wrapper = await mountSuspended(CrisisFooter)
    const text = wrapper.text()
    expect(text).toContain('Crisis Text Line')
    expect(text).toContain('HELLO')
    expect(text).toContain('741741')
  })
})
