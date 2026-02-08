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
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-gray-200 dark:border-gray-800">
      <nav class="max-w-5xl mx-auto px-2 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div class="app-brand">
          <img src="/logo_blue.png" class="app-logo" alt="Fuhgeddaboudit logo" />
          <NuxtLink to="/" data-testid="nav-brand" class="app-title-link">
            <span class="app-title">FUHGEDDABOUDIT</span>
          </NuxtLink>
        </div>
        <div class="flex items-center gap-2 sm:gap-4 flex-wrap justify-end text-sm sm:text-base">
          <template v-if="isLoggedIn">
            <NuxtLink to="/" class="whitespace-nowrap" data-testid="nav-dashboard">Dashboard</NuxtLink>
            <NuxtLink to="/progress" class="whitespace-nowrap" data-testid="nav-progress">Progress</NuxtLink>
            <NuxtLink
              v-if="navStatus?.activeModule"
              :to="`/modules/${navStatus.activeModule}/setup`"
              class="whitespace-nowrap"
              data-testid="nav-active-module"
            >
              {{ moduleLabels[navStatus.activeModule] || navStatus.activeModule }}
            </NuxtLink>

            <!-- Status badges -->
            <div v-if="navStatus" class="hidden sm:flex items-center gap-2 flex-wrap" data-testid="nav-badges">
              <span
                v-if="screeningEnabled && navStatus.screeningComplete"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                data-testid="badge-screening"
              >
                Screened
              </span>
              <span
                v-if="navStatus.preparationComplete"
                class="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                data-testid="badge-preparation"
              >
                Prepared
              </span>
            </div>

            <UButton variant="ghost" size="sm" @click="logout()">Log out</UButton>
          </template>
          <template v-else>
            <NuxtLink to="/auth/login" class="whitespace-nowrap">Log in</NuxtLink>
            <UButton to="/auth/register" size="sm">Register</UButton>
          </template>
        </div>
      </nav>
    </header>
    <GroundingPanicButton />
    <GroundingGroundingOverlay />
    <main class="max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-8 flex-1">
      <slot />
    </main>
    <SharedCrisisFooter />
  </div>
</template>

<style>
  .app-title {
    display: none;
    font-weight: 700;
    letter-spacing: 0.05em;
    white-space: nowrap;
    font-style: italic;
  }
  .app-title-link {
    line-height: 1;
  }
  .app-logo {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }
  .app-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    min-width: 0;
  }
  @media (min-width: 640px) {
    .app-title {
      display: inline;
      font-size: 18px;
    }
    .app-logo {
      width: 28px;
      height: 28px;
    }
  }
</style>
