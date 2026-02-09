const GUEST_MODE_KEY = 'mnemosyne-guest-mode'

export function useAuth() {
  const user = useState<{ id: string; email: string } | null>('auth-user', () => null)
  const guestMode = useState<boolean>('auth-guest-mode', () => false)

  const isLoggedIn = computed(() => !!user.value)
  const isGuest = computed(() => guestMode.value)
  const hasSession = computed(() => isLoggedIn.value || isGuest.value)

  async function fetchUser() {
    try {
      user.value = await $fetch('/api/auth/me')
    } catch {
      user.value = null
    }
  }

  function enterGuestMode() {
    guestMode.value = true
    if (import.meta.client) {
      localStorage.setItem(GUEST_MODE_KEY, 'true')
    }
    // Initialize guest store data from localStorage
    useGuestStore().load()
  }

  function exitGuestMode() {
    guestMode.value = false
    if (import.meta.client) {
      localStorage.removeItem(GUEST_MODE_KEY)
    }
    useGuestStore().clear()
  }

  function restoreGuestMode(): boolean {
    if (!import.meta.client) return false
    if (localStorage.getItem(GUEST_MODE_KEY) === 'true') {
      guestMode.value = true
      useGuestStore().load()
      return true
    }
    return false
  }

  async function register(email: string, password: string) {
    const data = await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    })
    // If registering from guest mode, exit guest mode
    if (guestMode.value) {
      exitGuestMode()
    }
    user.value = data
    return data
  }

  async function login(email: string, password: string) {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    // If logging in from guest mode, exit guest mode
    if (guestMode.value) {
      exitGuestMode()
    }
    user.value = data
    return data
  }

  async function logout() {
    if (isGuest.value) {
      exitGuestMode()
      return
    }
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return {
    user,
    isLoggedIn,
    isGuest,
    hasSession,
    fetchUser,
    enterGuestMode,
    exitGuestMode,
    restoreGuestMode,
    register,
    login,
    logout,
  }
}
