import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PreparationPage from '../../app/pages/preparation/index.vue'

// Mock localStorage (SafePlaceBuilder uses it on mount)
const storageMap = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storageMap.set(key, value)),
  removeItem: vi.fn((key: string) => storageMap.delete(key)),
  clear: vi.fn(() => storageMap.clear()),
  get length() { return storageMap.size },
  key: vi.fn((index: number) => [...storageMap.keys()][index] ?? null),
}
vi.stubGlobal('localStorage', mockLocalStorage)

describe('Preparation Page', () => {
  beforeEach(() => {
    storageMap.clear()
    vi.clearAllMocks()
  })

  it('renders with Safe Place as the first step', async () => {
    const wrapper = await mountSuspended(PreparationPage)
    expect(wrapper.text()).toContain('Preparation')
    expect(wrapper.text()).toContain('Step 1: Safe Place')
    expect(wrapper.text()).toContain('Step 2: Readiness Check')
    expect(wrapper.findComponent({ name: 'PreparationSafePlaceBuilder' }).exists()).toBe(true)
  })

  it('marks Step 1 as active and Step 2 as inactive', async () => {
    const wrapper = await mountSuspended(PreparationPage)
    const steps = wrapper.findAll('span')
    const step1 = steps.find(s => s.text().includes('Step 1'))
    const step2 = steps.find(s => s.text().includes('Step 2'))
    expect(step1?.classes()).toContain('text-primary')
    expect(step2?.classes()).toContain('text-gray-400')
  })
})
