import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PcPtsd5 from '../../app/components/screening/PcPtsd5.vue'

describe('PcPtsd5', () => {
  it('renders all 5 questions', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const questionBlocks = wrapper.findAll('.rounded-lg')
    expect(questionBlocks).toHaveLength(5)
  })

  it('renders the heading', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    expect(wrapper.find('h2').text()).toBe('PC-PTSD-5 Screening')
  })

  it('submit button is disabled when not all questions are answered', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const submitButton = wrapper.findAll('button').pop()!
    expect(submitButton.attributes('disabled')).toBeDefined()
  })

  it('enables submit button when all questions are answered', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const buttons = wrapper.findAll('button')

    // Each question has 2 buttons (Yes/No), plus 1 submit button = 11 buttons
    // Click "Yes" for each question (buttons at indices 0, 2, 4, 6, 8)
    for (let i = 0; i < 5; i++) {
      await buttons[i * 2].trigger('click')
    }

    const submitButton = wrapper.findAll('button').pop()!
    expect(submitButton.attributes('disabled')).toBeUndefined()
  })

  it('emits correct score of 5 when all answers are yes', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const buttons = wrapper.findAll('button')

    // Click "Yes" for all 5 questions
    for (let i = 0; i < 5; i++) {
      await buttons[i * 2].trigger('click')
    }

    // Click submit
    const submitButton = wrapper.findAll('button').pop()!
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([5, [true, true, true, true, true]])
  })

  it('emits correct score of 0 when all answers are no', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const buttons = wrapper.findAll('button')

    // Click "No" for all 5 questions (buttons at indices 1, 3, 5, 7, 9)
    for (let i = 0; i < 5; i++) {
      await buttons[i * 2 + 1].trigger('click')
    }

    const submitButton = wrapper.findAll('button').pop()!
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([0, [false, false, false, false, false]])
  })

  it('emits correct score of 3 for mixed answers', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const buttons = wrapper.findAll('button')

    // Yes, Yes, Yes, No, No → score 3
    await buttons[0].trigger('click') // Q1 Yes
    await buttons[2].trigger('click') // Q2 Yes
    await buttons[4].trigger('click') // Q3 Yes
    await buttons[7].trigger('click') // Q4 No
    await buttons[9].trigger('click') // Q5 No

    const submitButton = wrapper.findAll('button').pop()!
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([3, [true, true, true, false, false]])
  })

  it('allows changing an answer before submission', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const buttons = wrapper.findAll('button')

    // Answer all Yes first
    for (let i = 0; i < 5; i++) {
      await buttons[i * 2].trigger('click')
    }

    // Change Q1 to No
    await buttons[1].trigger('click')

    const submitButton = wrapper.findAll('button').pop()!
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([4, [false, true, true, true, true]])
  })

  it('does not emit when submit clicked with unanswered questions', async () => {
    const wrapper = await mountSuspended(PcPtsd5)
    const buttons = wrapper.findAll('button')

    // Only answer first 3 questions
    for (let i = 0; i < 3; i++) {
      await buttons[i * 2].trigger('click')
    }

    const submitButton = wrapper.findAll('button').pop()!
    await submitButton.trigger('click')

    expect(wrapper.emitted('complete')).toBeFalsy()
  })
})
