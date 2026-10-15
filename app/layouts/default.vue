<script setup lang="ts">
const { isLoggedIn, isGuest, hasSession, login, register, logout } = useAuth()
const config = useRuntimeConfig()
const screeningEnabled = config.public.screeningEnabled

interface NavStatus {
  screeningComplete: boolean
  preparationComplete: boolean
  activeModule: string | null
}

const navStatus = ref<NavStatus | null>(null)

const moduleLabels: Record<string, string> = {
  tetris: 'Tetris',
  rtm: 'RTM',
  tnt: 'TNT',
  emdr: 'EMDR',
}

async function loadNavStatus() {
  if (!hasSession.value) {
    navStatus.value = null
    return
  }
  try {
    const status = await useUserStatus().getStatus()
    navStatus.value = status as NavStatus
  } catch {
    // Silently ignore — nav badges are non-critical
  }
}

onMounted(() => loadNavStatus())

watch(hasSession, (active) => {
  if (active) loadNavStatus()
  else navStatus.value = null
})

// Mobile menu
const mobileMenuOpen = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { mobileMenuOpen.value = false })

// Auth modals
const loginOpen = ref(false)
const registerOpen = ref(false)

const loginEmail = ref('')
const loginPassword = ref('')
const loginError = ref('')
const loginLoading = ref(false)

const registerEmail = ref('')
const registerPassword = ref('')
const registerError = ref('')
const registerLoading = ref(false)

function openLogin() {
  loginEmail.value = ''
  loginPassword.value = ''
  loginError.value = ''
  registerOpen.value = false
  loginOpen.value = true
}

function openRegister() {
  registerEmail.value = ''
  registerPassword.value = ''
  registerError.value = ''
  loginOpen.value = false
  registerOpen.value = true
}

async function handleLogin() {
  loginError.value = ''
  loginLoading.value = true
  try {
    await login(loginEmail.value, loginPassword.value)
    loginOpen.value = false
    navigateTo('/')
  } catch (e: any) {
    loginError.value = e.data?.message || e.statusMessage || 'Login failed'
  } finally {
    loginLoading.value = false
  }
}

async function handleRegister() {
  registerError.value = ''
  registerLoading.value = true
  try {
    await register(registerEmail.value, registerPassword.value)
    registerOpen.value = false
    navigateTo('/')
  } catch (e: any) {
    registerError.value = e.data?.message || e.statusMessage || 'Registration failed'
  } finally {
    registerLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-void bg-grid">
    <!-- Glass morphism header -->
    <header class="header-glass sticky top-0 z-40">
      <nav class="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
        <div class="app-brand">
          <img src="/logo_blue.png" class="app-logo" alt="Fuhgeddaboudit logo" />
          <NuxtLink to="/" data-testid="nav-brand" class="app-title-link no-glow">
            <span class="app-title">FUHGEDDABOUDIT</span>
          </NuxtLink>
        </div>

        <!-- Desktop nav -->
        <div class="hidden sm:flex items-center gap-4 text-sm">
          <template v-if="hasSession">
            <NuxtLink to="/" class="nav-link whitespace-nowrap" data-testid="nav-dashboard">Dashboard</NuxtLink>
            <NuxtLink to="/progress" class="nav-link whitespace-nowrap" data-testid="nav-progress">Progress</NuxtLink>
            <NuxtLink
              v-if="navStatus?.activeModule"
              :to="`/modules/${navStatus.activeModule}/setup`"
              class="nav-link whitespace-nowrap"
              data-testid="nav-active-module"
            >
              {{ moduleLabels[navStatus.activeModule] || navStatus.activeModule }}
            </NuxtLink>

            <!-- LED status badges -->
            <div v-if="navStatus" class="flex items-center gap-2 flex-wrap" data-testid="nav-badges">
              <span
                v-if="screeningEnabled && navStatus.screeningComplete"
                class="led-badge led-badge-green"
                data-testid="badge-screening"
              >
                <span class="led-dot bg-green-400"></span>
                Screened
              </span>
              <span
                v-if="navStatus.preparationComplete"
                class="led-badge led-badge-green"
                data-testid="badge-preparation"
              >
                <span class="led-dot bg-green-400"></span>
                Prepared
              </span>
            </div>

            <button v-if="isGuest" class="nav-link whitespace-nowrap" data-testid="nav-create-account" @click="openRegister">Create Account</button>
            <UButton variant="ghost" size="sm" @click="logout()" class="nav-link" data-testid="nav-logout">
              {{ isGuest ? 'Exit Guest Mode' : 'Log out' }}
            </UButton>
          </template>
          <template v-else>
            <button class="nav-link whitespace-nowrap" @click="openLogin">Log in</button>
            <UButton size="sm" @click="openRegister">Register</UButton>
          </template>
        </div>

        <!-- Mobile hamburger -->
        <button
          class="sm:hidden nav-link p-1"
          aria-label="Toggle menu"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg v-if="!mobileMenuOpen" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </nav>

      <!-- Mobile menu panel -->
      <div v-if="mobileMenuOpen" class="sm:hidden border-t border-gray-800/60 px-4 py-3 space-y-3 text-sm">
        <template v-if="hasSession">
          <NuxtLink to="/" class="nav-link block py-1">Dashboard</NuxtLink>
          <NuxtLink to="/progress" class="nav-link block py-1">Progress</NuxtLink>
          <NuxtLink
            v-if="navStatus?.activeModule"
            :to="`/modules/${navStatus.activeModule}/setup`"
            class="nav-link block py-1"
          >
            {{ moduleLabels[navStatus.activeModule] || navStatus.activeModule }}
          </NuxtLink>
          <div v-if="navStatus" class="flex items-center gap-2 flex-wrap py-1">
            <span
              v-if="screeningEnabled && navStatus.screeningComplete"
              class="led-badge led-badge-green"
            >
              <span class="led-dot bg-green-400"></span>
              Screened
            </span>
            <span
              v-if="navStatus.preparationComplete"
              class="led-badge led-badge-green"
            >
              <span class="led-dot bg-green-400"></span>
              Prepared
            </span>
          </div>
          <button v-if="isGuest" class="nav-link block py-1" @click="openRegister">Create Account</button>
          <button class="nav-link block py-1" @click="logout()">
            {{ isGuest ? 'Exit Guest Mode' : 'Log out' }}
          </button>
        </template>
        <template v-else>
          <button class="nav-link block py-1" @click="openLogin">Log in</button>
          <button class="nav-link block py-1" @click="openRegister">Register</button>
        </template>
      </div>
    </header>
    <!-- <GroundingPanicButton /> -->
    <GroundingOverlay />
    <main class="max-w-5xl mx-auto w-full px-3 sm:px-4 py-6 sm:py-8 flex-1">
      <slot />
    </main>
    <SharedCrisisFooter />

    <!-- Login Modal -->
    <UModal v-model:open="loginOpen">
      <template #content>
        <div class="p-6 sm:p-8 space-y-5">
          <div class="flex items-center gap-2 mb-2 pb-4 border-b border-gray-700/50">
            <div class="flex gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-red-400/60"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400/60"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-green-400/60"></span>
            </div>
            <span class="font-mono text-xs text-gray-500 tracking-wider ml-2">MNEMOSYNE PROTOCOL v2.1</span>
          </div>
          <div class="space-y-2">
            <p class="font-mono text-xs text-gray-500 tracking-wide uppercase">Operator Authentication Required</p>
            <h2 class="text-2xl font-bold text-ghost text-glow-cyan">Log In</h2>
          </div>
          <form class="space-y-4 sm:space-y-5" @submit.prevent="handleLogin">
            <UFormField label="Email">
              <UInput v-model="loginEmail" type="email" placeholder="operator@example.com" required class="w-full" />
            </UFormField>
            <UFormField label="Password">
              <UInput v-model="loginPassword" type="password" placeholder="Enter credentials" required class="w-full" />
            </UFormField>
            <p v-if="loginError" class="text-red-400 text-sm font-mono">{{ loginError }}</p>
            <UButton type="submit" size="lg" block :loading="loginLoading">Authenticate</UButton>
            <p class="text-center text-sm text-gray-500">
              No account?
              <button type="button" class="text-cyan-400 hover:text-cyan-300" @click="openRegister">Register</button>
            </p>
          </form>
        </div>
      </template>
    </UModal>

    <!-- Register Modal -->
    <UModal v-model:open="registerOpen">
      <template #content>
        <div class="p-6 sm:p-8 space-y-5">
          <div class="flex items-center gap-2 mb-2 pb-4 border-b border-gray-700/50">
            <div class="flex gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-red-400/60"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-yellow-400/60"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-green-400/60"></span>
            </div>
            <span class="font-mono text-xs text-gray-500 tracking-wider ml-2">MNEMOSYNE PROTOCOL v2.1</span>
          </div>
          <div class="space-y-2">
            <p class="font-mono text-xs text-gray-500 tracking-wide uppercase">New Operator Registration</p>
            <h2 class="text-2xl font-bold text-ghost text-glow-cyan">Create Account</h2>
          </div>
          <form class="space-y-4 sm:space-y-5" @submit.prevent="handleRegister">
            <UFormField label="Email">
              <UInput v-model="registerEmail" type="email" placeholder="operator@example.com" required class="w-full" />
            </UFormField>
            <UFormField label="Password">
              <UInput v-model="registerPassword" type="password" placeholder="Min 8 characters" required class="w-full" />
            </UFormField>
            <p v-if="registerError" class="text-red-400 text-sm font-mono">{{ registerError }}</p>
            <UButton type="submit" size="lg" block :loading="registerLoading">Initialize Account</UButton>
            <p class="text-center text-sm text-gray-500">
              Already registered?
              <button type="button" class="text-cyan-400 hover:text-cyan-300" @click="openLogin">Log in</button>
            </p>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
  .header-glass {
    background: rgba(17, 18, 32, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(0, 212, 255, 0.08);
  }

  .app-title {
    display: none;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-weight: 600;
    letter-spacing: 0.15em;
    white-space: nowrap;
    font-style: normal;
    color: var(--color-ghost);
    font-size: 13px;
  }
  .app-title-link {
    line-height: 1;
    text-decoration: none;
  }
  .app-logo {
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: drop-shadow(0 0 6px rgba(0, 212, 255, 0.3));
  }
  .app-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
    min-width: 0;
  }
  @media (min-width: 640px) {
    .app-title {
      display: inline;
    }
    .app-logo {
      width: 28px;
      height: 28px;
    }
  }

  /* Nav links */
  .nav-link {
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
    color: var(--color-gray-400);
    text-decoration: none;
    transition: color 0.2s, text-shadow 0.2s;
  }
  .nav-link:hover {
    color: var(--color-cyan-400);
    text-shadow: 0 0 8px rgba(0, 212, 255, 0.3);
  }

  /* LED status badges */
  .led-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-size: 0.6875rem;
    letter-spacing: 0.05em;
    padding: 2px 10px 2px 8px;
    border-radius: 2px;
    background: rgba(0, 255, 135, 0.06);
    border: 1px solid rgba(0, 255, 135, 0.15);
    color: var(--color-green-400);
    text-transform: uppercase;
  }
  .led-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    box-shadow: 0 0 6px currentColor;
  }
</style>
