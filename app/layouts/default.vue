<script setup lang="ts">
const { isLoggedIn, logout } = useAuth()
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

onMounted(async () => {
  if (!isLoggedIn.value) return
  try {
    navStatus.value = await $fetch<NavStatus>('/api/user/status')
  } catch {
    // Silently ignore — nav badges are non-critical
  }
})

watch(isLoggedIn, async (loggedIn) => {
  if (loggedIn) {
    try {
      navStatus.value = await $fetch<NavStatus>('/api/user/status')
    } catch {
      // ignore
    }
  } else {
    navStatus.value = null
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-void bg-grid">
    <!-- Glass morphism header -->
    <header class="header-glass sticky top-0 z-40">
      <nav class="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div class="app-brand">
          <img src="/logo_blue.png" class="app-logo" alt="Fuhgeddaboudit logo" />
          <NuxtLink to="/" data-testid="nav-brand" class="app-title-link no-glow">
            <span class="app-title">FUHGEDDABOUDIT</span>
          </NuxtLink>
        </div>
        <div class="flex items-center gap-3 sm:gap-4 flex-wrap justify-end text-sm">
          <template v-if="isLoggedIn">
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
            <div v-if="navStatus" class="hidden sm:flex items-center gap-2 flex-wrap" data-testid="nav-badges">
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

            <UButton variant="ghost" size="sm" @click="logout()" class="nav-link">Log out</UButton>
          </template>
          <template v-else>
            <NuxtLink to="/auth/login" class="nav-link whitespace-nowrap">Log in</NuxtLink>
            <UButton to="/auth/register" size="sm">Register</UButton>
          </template>
        </div>
      </nav>
    </header>
    <GroundingPanicButton />
    <GroundingGroundingOverlay />
    <main class="max-w-5xl mx-auto w-full px-3 sm:px-4 py-6 sm:py-8 flex-1">
      <slot />
    </main>
    <SharedCrisisFooter />
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
