import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TriagePage from '../../app/pages/triage/index.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('Triage Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders all 4 symptom questions', async () => {
    const wrapper = await mountSuspended(TriagePage)

    expect(wrapper.find('[data-testid="step-questions"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('intrusive visual images')
    expect(wrapper.text()).toContain('intense fear, pain')
    expect(wrapper.text()).toContain('stop thinking')
    expect(wrapper.text()).toContain('general sense of distress')
  })

  it('disables Get Recommendation button until all questions answered', async () => {
    const wrapper = await mountSuspended(TriagePage)

    const btn = wrapper.find('[data-testid="get-recommendation"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('enables Get Recommendation button after all questions answered', async () => {
    const wrapper = await mountSuspended(TriagePage)

    // Answer all 4 questions by clicking rating buttons
    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    for (const block of questionBlocks) {
      const buttons = block.findAll('button')
      // Click the first rating button (rating = 1) for each question
      await buttons[0].trigger('click')
    }

    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-testid="get-recommendation"]')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('recommends the block game when intrusive images is rated highest', async () => {
    const wrapper = await mountSuspended(TriagePage)

    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    // Intrusive images = 5 (highest)
    const q1Buttons = questionBlocks[0].findAll('button')
    await q1Buttons[4].trigger('click') // rating 5

    // Fear/pain = 2
    const q2Buttons = questionBlocks[1].findAll('button')
    await q2Buttons[1].trigger('click') // rating 2

    // Can't stop thinking = 1
    const q3Buttons = questionBlocks[2].findAll('button')
    await q3Buttons[0].trigger('click') // rating 1

    // General distress = 3
    const q4Buttons = questionBlocks[3].findAll('button')
    await q4Buttons[2].trigger('click') // rating 3

    await wrapper.find('[data-testid="get-recommendation"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="step-recommendation"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Visuospatial Interference (Block Game)')
    expect(wrapper.text()).toContain('Recommended')
  })

  it('recommends RTM when fear/pain is rated highest', async () => {
    const wrapper = await mountSuspended(TriagePage)

    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    await questionBlocks[0].findAll('button')[0].trigger('click') // 1
    await questionBlocks[1].findAll('button')[4].trigger('click') // 5 (highest)
    await questionBlocks[2].findAll('button')[1].trigger('click') // 2
    await questionBlocks[3].findAll('button')[0].trigger('click') // 1

    await wrapper.find('[data-testid="get-recommendation"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="step-recommendation"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Reconsolidation of Traumatic Memories (RTM)')
  })

  it('recommends TNT when can\'t stop thinking is rated highest', async () => {
    const wrapper = await mountSuspended(TriagePage)

    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    await questionBlocks[0].findAll('button')[0].trigger('click') // 1
    await questionBlocks[1].findAll('button')[1].trigger('click') // 2
    await questionBlocks[2].findAll('button')[4].trigger('click') // 5 (highest)
    await questionBlocks[3].findAll('button')[0].trigger('click') // 1

    await wrapper.find('[data-testid="get-recommendation"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="step-recommendation"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Think/No-Think Suppression (TNT)')
  })

  it('recommends EMDR when general distress is rated highest', async () => {
    const wrapper = await mountSuspended(TriagePage)

    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    await questionBlocks[0].findAll('button')[0].trigger('click') // 1
    await questionBlocks[1].findAll('button')[1].trigger('click') // 2
    await questionBlocks[2].findAll('button')[0].trigger('click') // 1
    await questionBlocks[3].findAll('button')[4].trigger('click') // 5 (highest)

    await wrapper.find('[data-testid="get-recommendation"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="step-recommendation"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Eye Movement Desensitization (EMDR)')
  })

  it('allows user to override recommendation', async () => {
    mockFetch.mockResolvedValue({ success: true })
    const wrapper = await mountSuspended(TriagePage)

    // Answer all questions with intrusive images highest → Tetris recommended
    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    await questionBlocks[0].findAll('button')[4].trigger('click') // 5
    await questionBlocks[1].findAll('button')[0].trigger('click') // 1
    await questionBlocks[2].findAll('button')[0].trigger('click') // 1
    await questionBlocks[3].findAll('button')[0].trigger('click') // 1

    await wrapper.find('[data-testid="get-recommendation"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Override: select EMDR instead
    await wrapper.find('[data-testid="module-option-emdr"]').trigger('click')
    await wrapper.vm.$nextTick()

    // Submit
    await wrapper.find('[data-testid="start-protocol"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockFetch).toHaveBeenCalledWith('/api/triage/recommend', {
      method: 'POST',
      body: expect.objectContaining({
        recommendation: 'tetris',
        selectedModule: 'emdr',
      }),
    })
  })

  it('defaults to EMDR when all ratings are equal', async () => {
    const wrapper = await mountSuspended(TriagePage)

    // All rated the same (3)
    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    for (const block of questionBlocks) {
      await block.findAll('button')[2].trigger('click') // rating 3
    }

    await wrapper.find('[data-testid="get-recommendation"]').trigger('click')
    await wrapper.vm.$nextTick()

    // When all equal, first question wins (intrusive images → tetris)
    expect(wrapper.find('[data-testid="step-recommendation"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Visuospatial Interference (Block Game)')
  })

  it('shows error when submission fails', async () => {
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(TriagePage)

    // Answer all questions
    const questionBlocks = wrapper.findAll('.mb-6.p-4')
    for (const block of questionBlocks) {
      await block.findAll('button')[2].trigger('click')
    }

    await wrapper.find('[data-testid="get-recommendation"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="start-protocol"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Server error')
    })

    // Should return to recommendation step
    expect(wrapper.find('[data-testid="step-recommendation"]').exists()).toBe(true)
  })
})
