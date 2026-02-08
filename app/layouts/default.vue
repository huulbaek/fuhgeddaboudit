<script setup lang="ts">
const { isLoggedIn, logout } = useAuth()

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
      <nav class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <NuxtLink to="/" class="text-lg font-semibold">Mnemosyne</NuxtLink>
        <div class="flex items-center gap-4">
          <template v-if="isLoggedIn">
            <NuxtLink to="/" data-testid="nav-dashboard">Dashboard</NuxtLink>
            <NuxtLink to="/progress" data-testid="nav-progress">Progress</NuxtLink>
            <NuxtLink
              v-if="navStatus?.activeModule"
              :to="`/modules/${navStatus.activeModule}/setup`"
              data-testid="nav-active-module"
            >
              {{ moduleLabels[navStatus.activeModule] || navStatus.activeModule }}
            </NuxtLink>

            <!-- Status badges -->
            <div v-if="navStatus" class="flex items-center gap-2" data-testid="nav-badges">
              <span
                v-if="navStatus.screeningComplete"
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
            <NuxtLink to="/auth/login">Log in</NuxtLink>
            <UButton to="/auth/register" size="sm">Register</UButton>
          </template>
        </div>
      </nav>
    </header>
    <GroundingPanicButton />
    <GroundingGroundingOverlay />
    <main class="max-w-5xl mx-auto px-4 py-8 flex-1">
      <slot />
    </main>
    <SharedCrisisFooter />
  </div>
</template>
