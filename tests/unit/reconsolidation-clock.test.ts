import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ReconsolidationClock from '../../app/components/shared/ReconsolidationClock.vue'
import {
  useReconsolidationWindow,
  STORAGE_KEY,
  WINDOW_MS,
} from '../../app/composables/useReconsolidationWindow'

const HOUR = 60 * 60 * 1000

const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((k: string) => storage.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { storage.set(k, v) }),
  removeItem: vi.fn((k: string) => { storage.delete(k) }),
  clear: vi.fn(() => storage.clear()),
}
vi.stubGlobal('localStorage', mockLocalStorage)

const BASE = 1_700_000_000_000

describe('ReconsolidationClock', () => {
  const mounted: Array<{ unmount: () => void }> = []
  async function mount(props: Record<string, unknown> = {}) {
    const wrapper = await mountSuspended(ReconsolidationClock, { props })
    mounted.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    storage.clear()
    vi.spyOn(Date, 'now').mockReturnValue(BASE)
    useReconsolidationWindow().clear()
  })
  afterEach(() => {
    mounted.splice(0).forEach((w) => { try { w.unmount() } catch { /* already unmounted */ } })
    vi.restoreAllMocks()
  })

  it('shows only the reactivation prompt when no window is open', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="reconsolidation-clock"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reconsolidation-mark"]').exists()).toBe(true)
  })

  it('renders the remaining time while the window is open', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE - 30 * 60 * 1000, outcome: 'none' }))
    const wrapper = await mount()
    const clock = wrapper.find('[data-testid="reconsolidation-clock"]')
    expect(clock.exists()).toBe(true)
    expect(wrapper.find('[data-testid="reconsolidation-remaining"]').text()).toBe('5:30:00')
    expect(clock.text()).toContain('WINDOW OPEN')
    expect(wrapper.find('[data-testid="reconsolidation-mark"]').exists()).toBe(false)
  })

  it('turns amber and says closing in the last two hours', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE - 5 * HOUR, outcome: 'none' }))
    const wrapper = await mount()
    const clock = wrapper.find('[data-testid="reconsolidation-clock"]')
    expect(clock.text()).toContain('CLOSING')
    expect(clock.attributes('data-phase')).toBe('closing')
    expect(wrapper.find('[data-testid="reconsolidation-remaining"]').text()).toBe('1:00:00')
  })

  it('hides the clock once the window has expired', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE - WINDOW_MS, outcome: 'none' }))
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="reconsolidation-clock"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reconsolidation-mark"]').exists()).toBe(true)
  })

  it('marking a reactivation opens a fresh window', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-testid="reconsolidation-mark"]').trigger('click')
    expect(wrapper.find('[data-testid="reconsolidation-clock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reconsolidation-remaining"]').text()).toBe('6:00:00')
    expect(JSON.parse(storage.get(STORAGE_KEY)!)).toEqual({ openedAt: BASE, outcome: 'none' })
  })

  it('links to the active module while the window is open', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE, outcome: 'none' }))
    const wrapper = await mount({ activeModule: 'tetris' })
    const link = wrapper.find('[data-testid="reconsolidation-module-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/modules/tetris/setup')
    expect(link.text()).toContain('START BLOCK GAME NOW')
  })

  it('omits the module link when there is no active module', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE, outcome: 'none' }))
    const wrapper = await mount()
    expect(wrapper.find('[data-testid="reconsolidation-module-link"]').exists()).toBe(false)
  })

  it('does not announce the ticking digits to screen readers', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE, outcome: 'none' }))
    const wrapper = await mount()
    const clock = wrapper.find('[data-testid="reconsolidation-clock"]')
    expect(clock.attributes('aria-live')).toBeUndefined()
    expect(wrapper.find('[data-testid="reconsolidation-phase"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.find('[aria-live] [data-testid="reconsolidation-remaining"]').exists()).toBe(false)
  })

  it('after a completed session it reports the work as done and drops the call to action', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE, outcome: 'completed' }))
    const wrapper = await mount({ activeModule: 'tetris' })
    const clock = wrapper.find('[data-testid="reconsolidation-clock"]')
    expect(clock.attributes('data-outcome')).toBe('completed')
    expect(clock.text()).toContain('done')
    expect(wrapper.find('[data-testid="reconsolidation-module-link"]').exists()).toBe(false)
  })

  it('after an aborted session it offers no urgency and no call to action', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE - 5 * HOUR, outcome: 'aborted' }))
    const wrapper = await mount({ activeModule: 'emdr' })
    const clock = wrapper.find('[data-testid="reconsolidation-clock"]')
    expect(clock.attributes('data-outcome')).toBe('aborted')
    expect(clock.text()).not.toContain('CLOSING')
    expect(wrapper.find('[data-testid="reconsolidation-module-link"]').exists()).toBe(false)
  })

  it('can be dismissed, which forgets the window', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE, outcome: 'none' }))
    const wrapper = await mount()
    await wrapper.find('[data-testid="reconsolidation-dismiss"]').trigger('click')
    expect(wrapper.find('[data-testid="reconsolidation-clock"]').exists()).toBe(false)
    expect(storage.has(STORAGE_KEY)).toBe(false)
  })

  it('drains the arc as the window elapses', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ openedAt: BASE - 3 * HOUR, outcome: 'none' }))
    const wrapper = await mount()
    const arc = wrapper.find('[data-testid="reconsolidation-arc"]')
    expect(arc.exists()).toBe(true)
    // Half the window is gone: the dash offset is half the circumference.
    const dasharray = Number(arc.attributes('stroke-dasharray'))
    const offset = Number(arc.attributes('stroke-dashoffset'))
    expect(offset / dasharray).toBeCloseTo(0.5, 2)
  })
})
