import { describe, it, expect, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SessionLayout from '../../app/layouts/session.vue'
import DefaultLayout from '../../app/layouts/default.vue'
import GroundingOverlay from '../../app/components/grounding/GroundingOverlay.vue'

describe('SessionLayout', () => {
  afterEach(() => {
    const { isGrounding } = useGrounding()
    isGrounding.value = false
  })

  it('renders PanicButton', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    const panicButton = wrapper.find('button[aria-label="Grounding — I need to feel safe"]')
    expect(panicButton.exists()).toBe(true)
  })

  it('includes GroundingOverlay component', async () => {
    const wrapper = await mountSuspended(SessionLayout, {
      global: { components: { GroundingGroundingOverlay: GroundingOverlay } },
    })
    expect(wrapper.findComponent(GroundingOverlay).exists()).toBe(true)
  })

  it('renders slot content', async () => {
    const wrapper = await mountSuspended(SessionLayout, {
      slots: { default: () => '<div class="test-slot">Session content</div>' },
    })
    expect(wrapper.html()).toContain('test-slot')
  })

  it('does not render navigation', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.find('header').exists()).toBe(false)
  })
})

describe('DefaultLayout', () => {
  afterEach(() => {
    const { isGrounding } = useGrounding()
    isGrounding.value = false
  })

  it('renders navigation header', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('nav').exists()).toBe(true)
  })

  it('renders PanicButton', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    const panicButton = wrapper.find('button[aria-label="Grounding — I need to feel safe"]')
    expect(panicButton.exists()).toBe(true)
  })

  it('includes GroundingOverlay component', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      global: { components: { GroundingGroundingOverlay: GroundingOverlay } },
    })
    expect(wrapper.findComponent(GroundingOverlay).exists()).toBe(true)
  })

  it('shows Mnemosyne branding link', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    const brand = wrapper.find('a[href="/"]')
    expect(brand.exists()).toBe(true)
    expect(brand.text()).toContain('Mnemosyne')
  })

  it('renders slot content in main area', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: () => '<div class="test-slot">Page content</div>' },
    })
    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.html()).toContain('test-slot')
  })
})
