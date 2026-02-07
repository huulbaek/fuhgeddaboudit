export function useAuth() {
  const user = useState<{ id: string; email: string } | null>('auth-user', () => null)
  const isLoggedIn = computed(() => !!user.value)

  async function register(email: string, password: string) {
    const data = await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data
    return data
  }

  async function login(email: string, password: string) {
    const data = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data
    return data
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, isLoggedIn, register, login, logout }
}
