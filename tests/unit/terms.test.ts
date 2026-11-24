import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TermsPage from '../../app/pages/terms.vue'

describe('Terms of Service Page', () => {
  it('renders the page with all required sections', async () => {
    const wrapper = await mountSuspended(TermsPage)

    expect(wrapper.find('[data-testid="terms-page"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-purpose"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-not-therapy"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-legal-proceedings"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-data-privacy"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-assumption-of-risk"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-crisis-resources"]').exists()).toBe(true)
  })

  it('uses "symptom management" framing, not "forensic erasure"', async () => {
    const wrapper = await mountSuspended(TermsPage)
    const text = wrapper.text()

    expect(text).toContain('symptom management tool')
    // Framing: disclaims erasure capabilities, not promoting them
    expect(text).not.toContain('Forensic Erasure')
    expect(text).not.toContain('erase your memories')
    expect(text).toContain('does not erase, delete, or forensically remove memories')
  })

  it('includes legal proceedings warning', async () => {
    const wrapper = await mountSuspended(TermsPage)
    const text = wrapper.text()

    expect(text).toContain('Legal Proceedings Warning')
    expect(text).toContain('consult with your attorney before using this application')
    expect(text).toContain('admissibility or credibility')
  })

  it('includes crisis resources', async () => {
    const wrapper = await mountSuspended(TermsPage)
    const text = wrapper.text()

    expect(text).toContain('988')
    expect(text).toContain('741741')
    expect(text).toContain('Crisis Text Line')
  })

  it('includes data privacy disclosure', async () => {
    const wrapper = await mountSuspended(TermsPage)
    const text = wrapper.text()

    expect(text).toContain('No raw trauma content is ever stored')
    expect(text).toContain('scores, timestamps, and progress flags')
  })

  it('clarifies this is not a substitute for professional care', async () => {
    const wrapper = await mountSuspended(TermsPage)
    const text = wrapper.text()

    expect(text).toContain('Not a Substitute for Professional Care')
    expect(text).toContain('not a medical device')
  })
})
