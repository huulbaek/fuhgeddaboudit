import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useSessionService } from '../../app/composables/useSessionService'
import { useReconsolidationWindow } from '../../app/composables/useReconsolidationWindow'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v) },
  removeItem: (k: string) => { storage.delete(k) },
  clear: () => storage.clear(),
})

const mockGuest = ref(false)
mockNuxtImport('useAuth', () => () => ({
  isGuest: computed(() => mockGuest.value),
  isLoggedIn: computed(() => !mockGuest.value),
  hasSession: computed(() => true),
  fetchUser: vi.fn(async () => {}),
  restoreGuestMode: vi.fn(() => false),
}))

describe('useSessionService', () => {
  beforeEach(() => {
    storage.clear()
    mockFetch.mockReset()
    mockGuest.value = false
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    useReconsolidationWindow().clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the reconsolidation window when a guest session is created', async () => {
    mockGuest.value = true
    const session = await useSessionService().create({ module: 'tetris' })
    expect(session.id).toBeTruthy()
    expect(useReconsolidationWindow().phase.value).toBe('open')
  })

  it('opens the reconsolidation window when a server session is created', async () => {
    mockFetch.mockResolvedValue({ id: 's1', module: 'rtm' })
    await useSessionService().create({ module: 'rtm', suds: { rating: 6, phase: 'baseline' } })
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ method: 'POST' }))
    expect(useReconsolidationWindow().phase.value).toBe('open')
  })

  it('leaves the window closed when session creation fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    await expect(useSessionService().create({ module: 'rtm' })).rejects.toThrow('offline')
    expect(useReconsolidationWindow().phase.value).toBe('closed')
  })
})
