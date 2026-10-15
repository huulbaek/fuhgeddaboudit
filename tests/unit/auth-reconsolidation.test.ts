import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAuth } from '../../app/composables/useAuth'
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

describe('useAuth and the reconsolidation window', () => {
  beforeEach(() => {
    storage.clear()
    mockFetch.mockReset()
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    useReconsolidationWindow().clear()
    useAuth().user.value = null
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logging out clears the window', async () => {
    const auth = useAuth()
    auth.user.value = { id: 'u1', email: 'a@b.c' }
    useReconsolidationWindow().open()
    mockFetch.mockResolvedValue({})
    await auth.logout()
    expect(useReconsolidationWindow().phase.value).toBe('closed')
  })

  it('exiting guest mode clears the window', async () => {
    const auth = useAuth()
    auth.enterGuestMode()
    useReconsolidationWindow().open()
    await auth.logout()
    expect(useReconsolidationWindow().phase.value).toBe('closed')
  })

  it('registering from guest mode keeps the window', async () => {
    const auth = useAuth()
    auth.enterGuestMode()
    useReconsolidationWindow().open()
    mockFetch.mockResolvedValue({ id: 'u2', email: 'new@b.c' })
    await auth.register('new@b.c', 'password123')
    expect(auth.isGuest.value).toBe(false)
    expect(useReconsolidationWindow().phase.value).toBe('open')
  })
})
