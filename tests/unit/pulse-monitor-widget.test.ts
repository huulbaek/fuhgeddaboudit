import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PulseMonitor from '../../app/components/shared/PulseMonitor.vue'

const fake = {
  bpm: ref<number | null>(null),
  quality: ref(0),
  baseline: ref<number | null>(null),
  elevated: ref(false),
  waveform: ref(new Float64Array(0)),
  status: ref<'off' | 'starting' | 'acquiring' | 'running' | 'error'>('off'),
  error: ref<string | null>(null),
  start: vi.fn(async () => { fake.status.value = 'acquiring' }),
  stop: vi.fn(() => { fake.status.value = 'off' }),
  pushSample: vi.fn(),
  tick: vi.fn(),
}
vi.mock('../../app/composables/usePulseMonitor', () => ({ usePulseMonitor: () => fake }))

const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((k: string) => storage.get(k) ?? null),
  setItem: vi.fn((k: string, v: string) => { storage.set(k, v) }),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
vi.stubGlobal('localStorage', mockLocalStorage)
const fetchMock = vi.fn().mockResolvedValue({})
vi.stubGlobal('$fetch', fetchMock)

describe('PulseMonitor widget', () => {
  // Every mounted instance watches the shared fake; unmount them so earlier
  // tests' widgets cannot react in later tests.
  const mounted: Array<{ unmount: () => void }> = []
  async function mount(route: string) {
    const wrapper = await mountSuspended(PulseMonitor, { route })
    mounted.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    storage.clear()
    fake.status.value = 'off'
    fake.bpm.value = null
    fake.quality.value = 0
    fake.elevated.value = false
    fake.error.value = null
    fake.start.mockClear()
    fake.stop.mockClear()
    fetchMock.mockClear()
    mockLocalStorage.getItem.mockImplementation((k: string) => storage.get(k) ?? null)
    mockLocalStorage.setItem.mockImplementation((k: string, v: string) => { storage.set(k, v) })
    useGrounding().isGrounding.value = false
  })
  afterEach(() => {
    mounted.splice(0).forEach((w) => { try { w.unmount() } catch { /* already unmounted */ } })
    vi.restoreAllMocks()
  })

  it('is off by default and does not touch the camera', async () => {
    const wrapper = await mount('/modules/emdr/session')
    expect(wrapper.find('[data-testid="pulse-toggle"]').text()).toContain('Pulse')
    expect(fake.start).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="pulse-bpm"]').exists()).toBe(false)
  })

  it('clicking the toggle starts the monitor and remembers the choice', async () => {
    const wrapper = await mount('/modules/emdr/session')
    await wrapper.find('[data-testid="pulse-toggle"]').trigger('click')
    expect(fake.start).toHaveBeenCalledTimes(1)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('pulse-monitor-enabled', '1')
  })

  it('auto-starts when the preference is remembered', async () => {
    storage.set('pulse-monitor-enabled', '1')
    await mount('/modules/emdr/session')
    expect(fake.start).toHaveBeenCalledTimes(1)
  })

  it('starts off when localStorage throws', async () => {
    mockLocalStorage.getItem.mockImplementation(() => { throw new Error('private mode') })
    await mount('/modules/emdr/session')
    expect(fake.start).not.toHaveBeenCalled()
  })

  it('renders the rounded BPM and a good-signal dot while running', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mount('/modules/emdr/session')
    fake.status.value = 'running'
    fake.bpm.value = 71.6
    fake.quality.value = 0.8
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pulse-bpm"]').text()).toBe('72')
    expect(wrapper.find('[data-testid="pulse-quality"]').classes()).toContain('bg-cyan-400')
  })

  it('shows a weak-signal dot and placeholder when quality is poor', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mount('/modules/emdr/session')
    fake.status.value = 'acquiring'
    fake.bpm.value = null
    fake.quality.value = 0.1
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pulse-bpm"]').text()).toBe('--')
    expect(wrapper.find('[data-testid="pulse-quality"]').classes()).toContain('bg-amber-400')
    expect(wrapper.text()).toContain('Center your face')
  })

  it('triggers grounding once when elevated turns on', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mount('/modules/emdr/session')
    fake.status.value = 'running'
    fake.elevated.value = true
    await wrapper.vm.$nextTick()
    expect(useGrounding().isGrounding.value).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/grounding/log', expect.objectContaining({ body: { context: 'heart-rate-elevated' } }))
    expect(wrapper.text()).toContain('Elevated')
    // The user dismisses grounding while still elevated: no re-trigger
    useGrounding().isGrounding.value = false
    await wrapper.vm.$nextTick()
    expect(useGrounding().isGrounding.value).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not re-trigger within the cooldown after grounding is dismissed', async () => {
    let now = 100_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mount('/modules/emdr/session')
    fake.status.value = 'running'
    fake.elevated.value = true
    await wrapper.vm.$nextTick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // User dismisses, heart rate dips for one reading, then rises again 20 s later
    useGrounding().isGrounding.value = false
    fake.elevated.value = false
    await wrapper.vm.$nextTick()
    now += 20_000
    fake.elevated.value = true
    await wrapper.vm.$nextTick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // After the cooldown a new episode may trigger again
    fake.elevated.value = false
    await wrapper.vm.$nextTick()
    now += 3 * 60_000
    fake.elevated.value = true
    await wrapper.vm.$nextTick()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not trigger when grounding is already active', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mount('/modules/emdr/session')
    useGrounding().isGrounding.value = true
    fake.status.value = 'running'
    fake.elevated.value = true
    await wrapper.vm.$nextTick()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the camera error and keeps the toggle', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mount('/modules/emdr/session')
    fake.status.value = 'error'
    fake.error.value = 'permission-denied'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Camera denied')
    expect(wrapper.find('[data-testid="pulse-toggle"]').exists()).toBe(true)
  })

  it('is hidden on TNT routes', async () => {
    const wrapper = await mount('/modules/tnt/session')
    expect(wrapper.find('[data-testid="pulse-monitor"]').exists()).toBe(false)
  })

  it('stops the monitor on unmount', async () => {
    storage.set('pulse-monitor-enabled', '1')
    const wrapper = await mount('/modules/emdr/session')
    wrapper.unmount()
    expect(fake.stop).toHaveBeenCalled()
  })
})
