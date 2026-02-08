<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { isLoggedIn } = useAuth()
const config = useRuntimeConfig()
const screeningEnabled = config.public.screeningEnabled

interface UserStatus {
  screeningComplete: boolean
  preparationComplete: boolean
  activeModule: string | null
  lastTriageResult: string | null
  recentSessions: {
    id: string
    module: string
    startedAt: string | null
    completed: boolean | null
    aborted: boolean | null
  }[]
}

const status = ref<UserStatus | null>(null)
const loading = ref(false)
const error = ref('')

const moduleLabels: Record<string, string> = {
  tetris: 'Visuospatial Interference (Tetris)',
  rtm: 'RTM Rewind',
  tnt: 'Think/No-Think (TNT)',
  emdr: 'EMDR',
}

const nextStep = computed(() => {
  if (!status.value) return null
  if (!status.value.screeningComplete) {
    return { label: 'Start Screening', path: '/screening', description: 'Complete a brief safety screening before beginning.' }
  }
  if (!status.value.preparationComplete) {
    return { label: 'Start Preparation', path: '/preparation', description: 'Build your safe place and complete a readiness check.' }
  }
  if (!status.value.activeModule) {
    return { label: 'Start Triage', path: '/triage', description: 'Answer a few questions to find the best protocol for you.' }
  }
  return {
    label: `Continue ${moduleLabels[status.value.activeModule] || status.value.activeModule}`,
    path: `/modules/${status.value.activeModule}/setup`,
    description: 'Pick up where you left off.',
  }
})

onMounted(async () => {
  if (!isLoggedIn.value) return
  loading.value = true
  try {
    status.value = await $fetch<UserStatus>('/api/user/status')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to load status'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <!-- Logged-out hero -->
    <div v-if="!isLoggedIn" data-testid="hero">
      <div class="max-w-2xl mx-auto text-center py-10 sm:py-16">
        <h1 class="text-3xl sm:text-4xl font-bold mb-4">Mnemosyne Protocol</h1>
        <p class="text-base sm:text-lg text-gray-600 dark:text-gray-400 mb-8">
          Evidence-based neurocognitive protocols for dampening unwanted memories.
          Guided safely through screening, preparation, and clinically-informed modules.
        </p>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
          <UButton to="/auth/register" size="lg" color="primary" class="w-full sm:w-auto" data-testid="cta-register">
            Get Started
          </UButton>
          <UButton to="/auth/login" size="lg" variant="outline" color="neutral" class="w-full sm:w-auto" data-testid="cta-login">
            Log In
          </UButton>
        </div>
      </div>
    </div>

    <!-- Logged-in dashboard -->
    <div v-else data-testid="dashboard">
      <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

      <!-- Loading state -->
      <div v-if="loading" data-testid="loading">
        <p class="text-gray-500 dark:text-gray-400">Loading your status...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" data-testid="error">
        <p class="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
          {{ error }}
        </p>
      </div>

      <!-- Dashboard content -->
      <div v-else-if="status" data-testid="status">
        <!-- Progress steps -->
        <div class="mb-8" data-testid="progress-steps">
          <h2 class="text-lg font-semibold mb-4">Your Progress</h2>
          <div class="space-y-3">
            <div
              v-if="screeningEnabled"
              class="flex items-center gap-3 p-3 rounded-lg border"
              :class="status.screeningComplete
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950'
                : 'border-gray-200 dark:border-gray-700'"
              data-testid="step-screening"
            >
              <span
                class="w-6 h-6 min-w-6 min-h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                :class="status.screeningComplete
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >
                {{ status.screeningComplete ? '✓' : '1' }}
              </span>
              <span :class="status.screeningComplete ? 'text-green-700 dark:text-green-300' : ''">
                Safety Screening
              </span>
            </div>

            <div
              class="flex items-center gap-3 p-3 rounded-lg border"
              :class="status.preparationComplete
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950'
                : 'border-gray-200 dark:border-gray-700'"
              data-testid="step-preparation"
            >
              <span
                class="w-6 h-6 min-w-6 min-h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                :class="status.preparationComplete
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >
                {{ status.preparationComplete ? '✓' : '2' }}
              </span>
              <span :class="status.preparationComplete ? 'text-green-700 dark:text-green-300' : ''">
                Preparation
              </span>
            </div>

            <div
              class="flex flex-wrap items-start gap-3 p-3 rounded-lg border"
              :class="status.activeModule
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950'
                : 'border-gray-200 dark:border-gray-700'"
              data-testid="step-triage"
            >
              <span
                class="w-6 h-6 min-w-6 min-h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                :class="status.activeModule
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >
                {{ status.activeModule ? '✓' : '3' }}
              </span>
              <span class="min-w-0 flex-1" :class="status.activeModule ? 'text-green-700 dark:text-green-300' : ''">
                Triage & Module Selection
              </span>
              <span
                v-if="status.activeModule"
                class="w-full pl-9 sm:w-auto sm:pl-0 sm:ml-auto text-sm text-gray-500 dark:text-gray-400"
                data-testid="active-module-label"
              >
                {{ moduleLabels[status.activeModule] || status.activeModule }}
              </span>
            </div>
          </div>
        </div>

        <!-- Next step CTA -->
        <div v-if="nextStep" class="mb-8 p-3 sm:p-6 rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10" data-testid="next-step">
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">{{ nextStep.description }}</p>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <UButton :to="nextStep.path" size="lg" color="primary" class="w-full sm:w-auto" data-testid="next-step-button">
              {{ nextStep.label }}
            </UButton>
            <UButton
              v-if="status?.activeModule"
              to="/triage"
              size="lg"
              variant="outline"
              color="neutral"
              class="w-full sm:w-auto"
              data-testid="change-module-button"
            >
              Change Module
            </UButton>
          </div>
        </div>

        <!-- Recent sessions -->
        <div data-testid="recent-sessions">
          <h2 class="text-lg font-semibold mb-4">Recent Sessions</h2>
          <div v-if="status.recentSessions.length === 0" class="text-gray-500 dark:text-gray-400 text-sm">
            No sessions yet. Complete the steps above to begin.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="session in status.recentSessions"
              :key="session.id"
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div>
                <span class="font-medium">{{ moduleLabels[session.module] || session.module }}</span>
                <span v-if="session.startedAt" class="block sm:inline text-sm text-gray-500 dark:text-gray-400 sm:ml-2">
                  {{ new Date(session.startedAt).toLocaleDateString() }}
                </span>
              </div>
              <span
                v-if="session.completed"
                class="text-xs font-medium px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                data-testid="badge-completed"
              >
                Completed
              </span>
              <span
                v-else-if="session.aborted"
                class="text-xs font-medium px-2 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                data-testid="badge-aborted"
              >
                Aborted
              </span>
              <span
                v-else
                class="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
              >
                In Progress
              </span>
            </div>
          </div>
        </div>

        <!-- Link to full progress page -->
        <div v-if="status.recentSessions.length > 0" class="mt-4">
          <UButton to="/progress" variant="outline" color="neutral" size="sm">
            View Full Progress
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
