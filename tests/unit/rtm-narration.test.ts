import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRtmNarration } from '../../app/composables/useRtmNarration'

const setItem = vi.fn()
vi.stubGlobal('localStorage', { setItem, getItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() })

const fakeBuffer = { duration: 12, length: 1, sampleRate: 1, numberOfChannels: 1 } as unknown as AudioBuffer

describe('useRtmNarration', () => {
  beforeEach(() => {
    useRtmNarration().clear()
    setItem.mockClear()
  })

  it('starts empty', () => {
    expect(useRtmNarration().get()).toBeNull()
    expect(useRtmNarration().has()).toBe(false)
  })

  it('shares the stored buffer across composable instances', () => {
    useRtmNarration().set(fakeBuffer)
    expect(useRtmNarration().get()).toBe(fakeBuffer)
    expect(useRtmNarration().has()).toBe(true)
  })

  it('clear removes the buffer', () => {
    const narration = useRtmNarration()
    narration.set(fakeBuffer)
    narration.clear()
    expect(narration.get()).toBeNull()
  })

  it('never writes to localStorage', () => {
    useRtmNarration().set(fakeBuffer)
    expect(setItem).not.toHaveBeenCalled()
  })
})
