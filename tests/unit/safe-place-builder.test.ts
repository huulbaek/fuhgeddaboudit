import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SafePlaceBuilder from '../../app/components/preparation/SafePlaceBuilder.vue'

const storageMap = new Map<string, string>()

const mockLocalStorage = {
  getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storageMap.set(key, value)),
  removeItem: vi.fn((key: string) => storageMap.delete(key)),
  clear: vi.fn(() => storageMap.clear()),
  get length() {
    return storageMap.size
  },
  key: vi.fn((index: number) => [...storageMap.keys()][index] ?? null),
}

vi.stubGlobal('localStorage', mockLocalStorage)

describe('SafePlaceBuilder', () => {
  beforeEach(() => {
    storageMap.clear()
    vi.clearAllMocks()
  })

  it('renders heading and intro text', async () => {
    const wrapper = await mountSuspended(SafePlaceBuilder)
    expect(wrapper.find('h2').text()).toBe('Build Your Safe Place')
    expect(wrapper.text()).toContain('mental safe place')
  })

  it('shows the first guided step initially', async () => {
    const wrapper = await mountSuspended(SafePlaceBuilder)
    expect(wrapper.text()).toContain('Step 1 of 4')
    expect(wrapper.text()).toContain('Close your eyes and breathe')
  })

  it('advances through all 4 guided steps', async () => {
    const wrapper = await mountSuspended(SafePlaceBuilder)

    // Step 1
    expect(wrapper.text()).toContain('Step 1 of 4')
    const continueBtn = wrapper.findAll('button').pop()!
    expect(continueBtn.text()).toBe('Continue')
    await continueBtn.trigger('click')

    // Step 2
    expect(wrapper.text()).toContain('Step 2 of 4')
    expect(wrapper.text()).toContain('Imagine a safe place')
    await wrapper.findAll('button').pop()!.trigger('click')

    // Step 3
    expect(wrapper.text()).toContain('Step 3 of 4')
    expect(wrapper.text()).toContain('Engage your senses')
    await wrapper.findAll('button').pop()!.trigger('click')

    // Step 4
    expect(wrapper.text()).toContain('Step 4 of 4')
    expect(wrapper.text()).toContain('Anchor the feeling')
    const lastBtn = wrapper.findAll('button').pop()!
    expect(lastBtn.text()).toBe('Describe Your Safe Place')
  })

  it('shows description input after completing all steps', async () => {
    const wrapper = await mountSuspended(SafePlaceBuilder)

    for (let i = 0; i < 4; i++) {
      await wrapper.findAll('button').pop()!.trigger('click')
    }

    expect(wrapper.text()).toContain('Describe your safe place')
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('save button is disabled when description is empty', async () => {
    const wrapper = await mountSuspended(SafePlaceBuilder)

    for (let i = 0; i < 4; i++) {
      await wrapper.findAll('button').pop()!.trigger('click')
    }

    const saveBtn = wrapper.findAll('button').pop()!
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('emits complete with description and saves to localStorage', async () => {
    const wrapper = await mountSuspended(SafePlaceBuilder)

    for (let i = 0; i < 4; i++) {
      await wrapper.findAll('button').pop()!.trigger('click')
    }

    const textarea = wrapper.find('textarea')
    await textarea.setValue('A quiet beach at sunset')

    const saveBtn = wrapper.findAll('button').pop()!
    await saveBtn.trigger('click')

    const emitted = wrapper.emitted('complete')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['A quiet beach at sunset'])
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'mnemosyne-safe-place',
      'A quiet beach at sunset',
    )
  })

  it('loads saved description from localStorage on mount', async () => {
    storageMap.set('mnemosyne-safe-place', 'A cabin in the mountains')

    const wrapper = await mountSuspended(SafePlaceBuilder)

    // Advance to description input
    for (let i = 0; i < 4; i++) {
      await wrapper.findAll('button').pop()!.trigger('click')
    }

    const textarea = wrapper.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('A cabin in the mountains')
  })

  it('does not emit when description is only whitespace', async () => {
    const wrapper = await mountSuspended(SafePlaceBuilder)

    for (let i = 0; i < 4; i++) {
      await wrapper.findAll('button').pop()!.trigger('click')
    }

    const textarea = wrapper.find('textarea')
    await textarea.setValue('   ')

    const saveBtn = wrapper.findAll('button').pop()!
    await saveBtn.trigger('click')

    expect(wrapper.emitted('complete')).toBeFalsy()
  })
})
