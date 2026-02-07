import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DesBrief from '../../app/components/screening/DesBrief.vue'

describe('DesBrief', () => {
  it('renders all 8 questions', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')
    expect(questionBlocks).toHaveLength(8)
  })

  it('renders the heading', async () => {
    const wrapper = await mountSuspended(DesBrief)
    expect(wrapper.find('h2').text()).toBe('DES-Brief Dissociation Screening')
  })

  it('submit button is disabled when not all questions are answered', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    expect(submitButton.attributes('disabled')).toBeDefined()
  })

  it('enables submit button when all questions are answered', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')

    // Click the first option (0%) in each question block
    for (const block of questionBlocks) {
      const firstOption = block.findAll('button')[0]
      await firstOption.trigger('click')
    }

    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    expect(submitButton.attributes('disabled')).toBeUndefined()
  })

  it('emits score of 0 when all answers are 0%', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')

    // Click 0% for all 8 questions
    for (const block of questionBlocks) {
      const firstOption = block.findAll('button')[0]
      await firstOption.trigger('click')
    }

    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([0, [0, 0, 0, 0, 0, 0, 0, 0]])
  })

  it('emits score of 100 when all answers are 100%', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')

    // Click 100% for all 8 questions (last option button in each block)
    for (const block of questionBlocks) {
      const options = block.findAll('button')
      const lastOption = options[options.length - 1]
      await lastOption.trigger('click')
    }

    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([100, [100, 100, 100, 100, 100, 100, 100, 100]])
  })

  it('emits correct mean score for mixed answers', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')

    // Set specific answers: 0, 10, 20, 30, 40, 50, 60, 70
    // Mean = (0+10+20+30+40+50+60+70)/8 = 280/8 = 35
    const targetValues = [0, 10, 20, 30, 40, 50, 60, 70]
    for (let i = 0; i < 8; i++) {
      const optionIndex = targetValues[i] / 10 // 0% is index 0, 10% is index 1, etc.
      const options = questionBlocks[i].findAll('button')
      await options[optionIndex].trigger('click')
    }

    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual([35, [0, 10, 20, 30, 40, 50, 60, 70]])
  })

  it('rounds mean score to nearest integer', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')

    // Set answers: 10, 10, 10, 10, 10, 10, 10, 20
    // Mean = (10*7 + 20)/8 = 90/8 = 11.25 → rounds to 11
    for (let i = 0; i < 7; i++) {
      const options = questionBlocks[i].findAll('button')
      await options[1].trigger('click') // 10%
    }
    const lastOptions = questionBlocks[7].findAll('button')
    await lastOptions[2].trigger('click') // 20%

    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toBe(11)
  })

  it('allows changing an answer before submission', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')

    // Answer all with 50%
    for (const block of questionBlocks) {
      const options = block.findAll('button')
      await options[5].trigger('click') // 50%
    }

    // Change Q1 to 0%
    const firstBlockOptions = questionBlocks[0].findAll('button')
    await firstBlockOptions[0].trigger('click') // 0%

    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    // Mean = (0 + 50*7)/8 = 350/8 = 43.75 → rounds to 44
    expect(emitted![0]).toEqual([44, [0, 50, 50, 50, 50, 50, 50, 50]])
  })

  it('does not emit when submit clicked with unanswered questions', async () => {
    const wrapper = await mountSuspended(DesBrief)
    const questionBlocks = wrapper.findAll('.rounded-lg')

    // Only answer first 5 questions
    for (let i = 0; i < 5; i++) {
      const options = questionBlocks[i].findAll('button')
      await options[0].trigger('click')
    }

    const allButtons = wrapper.findAll('button')
    const submitButton = allButtons[allButtons.length - 1]
    await submitButton.trigger('click')

    expect(wrapper.emitted('complete')).toBeFalsy()
  })
})
