import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SudsScale from '../../app/components/shared/SudsScale.vue'

describe('SudsScale', () => {
  it('renders heading and description', async () => {
    const wrapper = await mountSuspended(SudsScale)
    expect(wrapper.find('h3').text()).toBe('Distress Rating (SUDs)')
    expect(wrapper.text()).toContain('0 (no distress)')
    expect(wrapper.text()).toContain('10 (worst')
  })

  it('renders 11 rating buttons (0-10)', async () => {
    const wrapper = await mountSuspended(SudsScale)
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(11)
    expect(buttons[0].text()).toBe('0')
    expect(buttons[10].text()).toBe('10')
  })

  it('emits select with rating when a button is clicked', async () => {
    const wrapper = await mountSuspended(SudsScale)
    const buttons = wrapper.findAll('button')

    await buttons[7].trigger('click')

    const emitted = wrapper.emitted('select')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([7])
  })

  it('highlights the selected button', async () => {
    const wrapper = await mountSuspended(SudsScale)
    const buttons = wrapper.findAll('button')

    await buttons[3].trigger('click')

    expect(buttons[3].attributes('aria-pressed')).toBe('true')
    expect(buttons[3].classes()).toContain('suds-btn-active')
    expect(buttons[0].attributes('aria-pressed')).toBe('false')
    expect(buttons[0].classes()).not.toContain('suds-btn-active')
  })

  it('updates selection when a different button is clicked', async () => {
    const wrapper = await mountSuspended(SudsScale)
    const buttons = wrapper.findAll('button')

    await buttons[2].trigger('click')
    await buttons[8].trigger('click')

    const emitted = wrapper.emitted('select')
    expect(emitted).toHaveLength(2)
    expect(emitted![0]).toEqual([2])
    expect(emitted![1]).toEqual([8])

    expect(buttons[8].attributes('aria-pressed')).toBe('true')
    expect(buttons[2].attributes('aria-pressed')).toBe('false')
  })

  it('accepts modelValue prop to set initial selection', async () => {
    const wrapper = await mountSuspended(SudsScale, {
      props: { modelValue: 5 },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[5].attributes('aria-pressed')).toBe('true')
    expect(buttons[4].attributes('aria-pressed')).toBe('false')
  })

  it('does not emit when disabled', async () => {
    const wrapper = await mountSuspended(SudsScale, {
      props: { disabled: true },
    })
    const buttons = wrapper.findAll('button')

    await buttons[4].trigger('click')

    const emitted = wrapper.emitted('select')
    expect(emitted).toBeFalsy()
  })

  it('renders anchor labels: None, Moderate, Worst', async () => {
    const wrapper = await mountSuspended(SudsScale)
    expect(wrapper.text()).toContain('None')
    expect(wrapper.text()).toContain('Moderate')
    expect(wrapper.text()).toContain('Worst')
  })

  it('has correct aria attributes on buttons', async () => {
    const wrapper = await mountSuspended(SudsScale)
    const buttons = wrapper.findAll('button')

    expect(buttons[0].attributes('aria-label')).toBe(
      'Rate distress 0 out of 10',
    )
    expect(buttons[10].attributes('aria-label')).toBe(
      'Rate distress 10 out of 10',
    )

    await buttons[6].trigger('click')
    expect(buttons[6].attributes('aria-pressed')).toBe('true')
    expect(buttons[0].attributes('aria-pressed')).toBe('false')
  })
})
