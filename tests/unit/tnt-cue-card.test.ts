import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import CueCard from '../../app/components/tnt/CueCard.vue'

const makeCue = (overrides = {}) => ({
  id: 'lib-circle',
  src: '/images/cues/geometric-circle.svg',
  name: 'Circle',
  ...overrides,
})

describe('TNT CueCard', () => {
  it('renders cue image with correct src and alt', async () => {
    const cue = makeCue()
    const wrapper = await mountSuspended(CueCard, {
      props: { cue, condition: 'think' },
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe(cue.src)
    expect(img.attributes('alt')).toBe(cue.name)
  })

  it('displays green border and "Think" label for think condition', async () => {
    const wrapper = await mountSuspended(CueCard, {
      props: { cue: makeCue(), condition: 'think' },
    })
    const frame = wrapper.find('.border-green-500')
    expect(frame.exists()).toBe(true)
    expect(wrapper.text()).toContain('Think')
    expect(wrapper.find('[data-testid="cue-card-think"]').exists()).toBe(true)
  })

  it('displays red border and "No-Think" label for no-think condition', async () => {
    const wrapper = await mountSuspended(CueCard, {
      props: { cue: makeCue(), condition: 'no-think' },
    })
    const frame = wrapper.find('.border-red-500')
    expect(frame.exists()).toBe(true)
    expect(wrapper.text()).toContain('No-Think')
    expect(wrapper.find('[data-testid="cue-card-no-think"]').exists()).toBe(true)
  })

  it('has accessible aria-label with cue name and condition', async () => {
    const cue = makeCue({ name: 'Star' })
    const wrapper = await mountSuspended(CueCard, {
      props: { cue, condition: 'think' },
    })
    const container = wrapper.find('[role="img"]')
    expect(container.attributes('aria-label')).toBe('Star — Think')
  })

  it('sets no-think aria-label correctly', async () => {
    const wrapper = await mountSuspended(CueCard, {
      props: { cue: makeCue({ name: 'Diamond' }), condition: 'no-think' },
    })
    const container = wrapper.find('[role="img"]')
    expect(container.attributes('aria-label')).toBe('Diamond — No-Think')
  })

  it('works with uploaded cue images', async () => {
    const cue = makeCue({
      id: 'upload-12345',
      src: 'blob:http://localhost:3000/abc-123',
      name: 'my-photo.jpg',
      source: 'upload',
    })
    const wrapper = await mountSuspended(CueCard, {
      props: { cue, condition: 'no-think' },
    })
    const img = wrapper.find('img')
    expect(img.attributes('src')).toBe(cue.src)
    expect(img.attributes('alt')).toBe('my-photo.jpg')
  })
})
