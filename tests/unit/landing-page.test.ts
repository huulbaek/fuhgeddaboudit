import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import LandingPage from '../../app/pages/index.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mockUser = ref<{ id: string; email: string } | null>(null)
const mockGuestMode = ref(false)

mockNuxtImport('useAuth', () => {
  return () => {
    const isLoggedIn = computed(() => !!mockUser.value)
    const isGuest = computed(() => mockGuestMode.value)
    return {
      user: mockUser,
      isLoggedIn,
      isGuest,
      hasSession: computed(() => isLoggedIn.value || isGuest.value),
      enterGuestMode: vi.fn(() => { mockGuestMode.value = true }),
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    }
  }
})

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    screeningComplete: false,
    preparationComplete: false,
    activeModule: null,
    lastTriageResult: null,
    recentSessions: [],
    ...overrides,
  }
}

describe('Landing Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockUser.value = null
    mockGuestMode.value = false
  })

  it('shows hero section when not logged in', async () => {
    const wrapper = await mountSuspended(LandingPage)
    expect(wrapper.find('[data-testid="hero"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Mnemosyne Protocol')
    expect(wrapper.find('[data-testid="cta-register"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cta-login"]').exists()).toBe(true)
  })

  it('shows dashboard when logged in', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus())
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="dashboard"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="hero"]').exists()).toBe(false)
  })

  it('shows loading state while fetching', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const wrapper = await mountSuspended(LandingPage)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('shows error when fetch fails', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockRejectedValue({ data: { message: 'Server error' } })
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('Server error')
  })

  it('shows "Start Screening" when screening not complete', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus())
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="next-step"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="next-step-button"]').text()).toContain('Start Screening')
  })

  it('shows "Start Preparation" when screening complete but preparation not', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus({ screeningComplete: true }))
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="next-step"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="next-step-button"]').text()).toContain('Start Preparation')
  })

  it('shows "Start Triage" when preparation complete but no active module', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus({
      screeningComplete: true,
      preparationComplete: true,
    }))
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="next-step"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="next-step-button"]').text()).toContain('Start Triage')
  })

  it('shows "Continue" with module name when active module is set', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus({
      screeningComplete: true,
      preparationComplete: true,
      activeModule: 'rtm',
      lastTriageResult: 'rtm',
    }))
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="next-step"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="next-step-button"]').text()).toContain('Continue')
    expect(wrapper.find('[data-testid="next-step-button"]').text()).toContain('RTM')
  })

  it('displays compact progress stepper', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus({
      screeningComplete: true,
      preparationComplete: false,
    }))
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="progress-steps"]').exists()).toBe(true)
    })

    const stepperText = wrapper.find('[data-testid="progress-steps"]').text()
    expect(stepperText).toContain('Preparation')
    expect(stepperText).toContain('Triage')
  })

  it('shows active module label in triage step', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus({
      screeningComplete: true,
      preparationComplete: true,
      activeModule: 'tetris',
    }))
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="active-module-label"]').exists()).toBe(true)
    })

    expect(wrapper.find('[data-testid="active-module-label"]').text()).toContain('Tetris')
  })

  it('shows recent sessions with completion badges', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus({
      screeningComplete: true,
      preparationComplete: true,
      activeModule: 'rtm',
      recentSessions: [
        { id: 's1', module: 'rtm', startedAt: '2026-01-10T10:00:00Z', completed: true, aborted: false },
        { id: 's2', module: 'rtm', startedAt: '2026-01-12T10:00:00Z', completed: false, aborted: true },
      ],
    }))
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="recent-sessions"]').exists()).toBe(true)
    })

    expect(wrapper.findAll('[data-testid="badge-completed"]').length).toBe(1)
    expect(wrapper.findAll('[data-testid="badge-aborted"]').length).toBe(1)
  })

  it('shows empty session message when no sessions', async () => {
    mockUser.value = { id: 'u1', email: 'test@test.com' }
    mockFetch.mockResolvedValue(makeStatus())
    const wrapper = await mountSuspended(LandingPage)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="recent-sessions"]').exists()).toBe(true)
    })

    expect(wrapper.text()).toContain('No sessions recorded yet')
  })
})
