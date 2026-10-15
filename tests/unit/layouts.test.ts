import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import SessionLayout from '../../app/layouts/session.vue'
import DefaultLayout from '../../app/layouts/default.vue'
import GroundingOverlay from '../../app/components/grounding/GroundingOverlay.vue'
import { useReconsolidationWindow } from '../../app/composables/useReconsolidationWindow'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mockUser = ref<{ id: string; email: string } | null>(null)

mockNuxtImport('useAuth', () => {
  return () => {
    const isLoggedIn = computed(() => !!mockUser.value)
    const isGuest = computed(() => false)
    return {
      user: mockUser,
      isLoggedIn,
      isGuest,
      hasSession: computed(() => isLoggedIn.value || isGuest.value),
      fetchUser: vi.fn(async () => {}),
      enterGuestMode: vi.fn(),
      exitGuestMode: vi.fn(),
      restoreGuestMode: vi.fn(() => false),
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    }
  }
})

describe('SessionLayout', () => {
  afterEach(() => {
    const { isGrounding } = useGrounding()
    isGrounding.value = false
  })

  it('renders PanicButton', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    const panicButton = wrapper.find('button[aria-label="Grounding — I need to feel safe"]')
    expect(panicButton.exists()).toBe(true)
  })

  it('includes GroundingOverlay component', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    expect(wrapper.findComponent(GroundingOverlay).exists()).toBe(true)
  })

  it('shows the grounding overlay when grounding is triggered', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    useGrounding().isGrounding.value = true
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('You are safe')
  })

  it('renders slot content', async () => {
    const wrapper = await mountSuspended(SessionLayout, {
      slots: { default: () => '<div class="test-slot">Session content</div>' },
    })
    expect(wrapper.html()).toContain('test-slot')
  })

  it('does not render navigation', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.find('header').exists()).toBe(false)
  })

  it('includes the pulse monitor widget', async () => {
    const wrapper = await mountSuspended(SessionLayout)
    expect(wrapper.findComponent({ name: 'SharedPulseMonitor' }).exists()).toBe(true)
  })
})

describe('DefaultLayout', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockUser.value = null
  })

  afterEach(() => {
    const { isGrounding } = useGrounding()
    isGrounding.value = false
  })

  it('renders navigation header', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('nav').exists()).toBe(true)
  })

  it('renders PanicButton', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    const panicButton = wrapper.find('button[aria-label="Grounding — I need to feel safe"]')
    expect(panicButton.exists()).toBe(true)
  })

  it('includes GroundingOverlay component', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    expect(wrapper.findComponent(GroundingOverlay).exists()).toBe(true)
  })

  it('shows fuhgeddaboudit branding link', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    const brand = wrapper.find('[data-testid="nav-brand"]')
    const brandText = wrapper.find('[data-testid="nav-brand"] .app-title')
    expect(brand.exists()).toBe(true)
    expect(brandText.exists()).toBe(true)
    expect(brand.text()).toContain('FUHGEDDABOUDIT')
  })

  it('renders slot content in main area', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: () => '<div class="test-slot">Page content</div>' },
    })
    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.html()).toContain('test-slot')
  })

  it('shows login/register links when not logged in', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    expect(wrapper.find('a[href="/auth/login"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-dashboard"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="nav-progress"]').exists()).toBe(false)
  })

  it('shows dashboard and progress links when logged in', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({
      screeningComplete: false,
      preparationComplete: false,
      activeModule: null,
    })
    const wrapper = await mountSuspended(DefaultLayout)

    expect(wrapper.find('[data-testid="nav-dashboard"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-progress"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-dashboard"]').text()).toBe('Dashboard')
    expect(wrapper.find('[data-testid="nav-progress"]').text()).toBe('Progress')
  })

  it('shows active module link when user has active module', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({
      screeningComplete: true,
      preparationComplete: true,
      activeModule: 'rtm',
    })
    const wrapper = await mountSuspended(DefaultLayout)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="nav-active-module"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="nav-active-module"]').text()).toBe('RTM')
    expect(wrapper.find('[data-testid="nav-active-module"]').attributes('href')).toBe('/modules/rtm/setup')
  })

  it('does not show active module link when no module is active', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({
      screeningComplete: true,
      preparationComplete: true,
      activeModule: null,
    })
    const wrapper = await mountSuspended(DefaultLayout)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="nav-badges"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="nav-active-module"]').exists()).toBe(false)
  })

  it('does not show screening badge when screening feature is disabled', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({
      screeningComplete: true,
      preparationComplete: false,
      activeModule: null,
    })
    const wrapper = await mountSuspended(DefaultLayout)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="nav-badges"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="badge-screening"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="badge-preparation"]').exists()).toBe(false)
  })

  it('shows preparation badge when preparation is complete', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({
      screeningComplete: true,
      preparationComplete: true,
      activeModule: null,
    })
    const wrapper = await mountSuspended(DefaultLayout)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="badge-preparation"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="badge-screening"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="badge-preparation"]').text()).toBe('Prepared')
  })

  it('shows a reconsolidation badge while a window is open', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({ screeningComplete: true, preparationComplete: true, activeModule: 'rtm' })
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    useReconsolidationWindow().open()
    const wrapper = await mountSuspended(DefaultLayout)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="badge-reconsolidation"]').exists()).toBe(true)
    })
    expect(wrapper.find('[data-testid="badge-reconsolidation"]').text()).toContain('6:00:00')
    useReconsolidationWindow().clear()
    vi.restoreAllMocks()
  })

  it('shows no reconsolidation badge when no window is open', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({ screeningComplete: true, preparationComplete: true, activeModule: 'rtm' })
    useReconsolidationWindow().clear()
    const wrapper = await mountSuspended(DefaultLayout)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="nav-badges"]').exists()).toBe(true)
    })
    expect(wrapper.find('[data-testid="badge-reconsolidation"]').exists()).toBe(false)
  })

  it('shows no badges when nothing is complete', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue({
      screeningComplete: false,
      preparationComplete: false,
      activeModule: null,
    })
    const wrapper = await mountSuspended(DefaultLayout)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="nav-badges"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="badge-screening"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="badge-preparation"]').exists()).toBe(false)
  })
})
