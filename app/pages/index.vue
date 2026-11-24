<script setup lang="ts">
definePageMeta({ layout: 'default' })

const reqUrl = useRequestURL()
useHead({
  title: 'Mnemosyne Protocol — Evidence-Based Neurocognitive Memory Dampening',
  titleTemplate: '',
  link: [{ rel: 'canonical', href: `${reqUrl.origin}/` }],
})
useSeoMeta({
  description: 'Guided neurocognitive protocols (RTM, TNT, visuospatial interference, EMDR) for reducing the emotional intensity of unwanted memories. Free, private, clinically informed.',
  ogTitle: 'Mnemosyne Protocol — Neurocognitive Memory Dampening',
  ogDescription: 'Evidence-based protocols for dampening unwanted memories. Guided safely through screening, preparation, and clinically-informed modules.',
})

const { isLoggedIn, hasSession, enterGuestMode } = useAuth()
const config = useRuntimeConfig()
const screeningEnabled = config.public.screeningEnabled

const { data: purgedStats } = useFetch('/api/stats/purged', { server: false })

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
  tetris: 'Visuospatial Interference (Block Game)',
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

function startGuestMode() {
  enterGuestMode()
  // Reload status after entering guest mode
  loadStatus()
}

async function loadStatus() {
  if (!hasSession.value) return
  loading.value = true
  try {
    status.value = await useUserStatus().getStatus() as UserStatus
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to load status'
  } finally {
    loading.value = false
  }
}

onMounted(() => loadStatus())
</script>

<template>
  <div>
    <ClientOnly>
      <!-- New visitor hero -->
      <div v-if="!hasSession" data-testid="hero">
        <div class="max-w-2xl mx-auto text-center py-12 sm:py-20">
          <p class="font-mono text-xs text-cyan-400/70 tracking-[0.3em] uppercase mb-4 animate-fade-in-up">Neurocognitive Memory Protocol</p>
          <h1 class="text-4xl sm:text-5xl font-bold mb-2 text-glow-cyan animate-fade-in-up" style="animation-delay: 0.1s">
            Mnemosyne Protocol
          </h1>
          <p class="font-mono text-sm text-gray-500 mb-3 animate-fade-in-up" style="animation-delay: 0.15s">
            FUHGEDDABOUDIT
          </p>
          <p v-if="purgedStats" class="font-mono text-xs text-gray-600 mb-8 animate-fade-in-up" style="animation-delay: 0.18s">
            &gt; {{ purgedStats.count.toLocaleString() }} memories purged<span class="animate-pulse">_</span>
          </p>
          <p v-else class="mb-8"></p>
          <p class="text-base sm:text-lg text-gray-400 mb-10 max-w-lg mx-auto animate-fade-in-up" style="animation-delay: 0.2s">
            Evidence-based neurocognitive protocols for dampening unwanted memories.
            Guided safely through screening, preparation, and clinically-informed modules.
          </p>
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 animate-fade-in-up" style="animation-delay: 0.3s">
            <UButton to="/auth/register" size="lg" color="primary" class="w-full sm:w-auto glow-cyan" data-testid="cta-register">
              Initialize Protocol
            </UButton>
            <UButton to="/auth/login" size="lg" variant="outline" color="neutral" class="w-full sm:w-auto" data-testid="cta-login">
              Log In
            </UButton>
          </div>
          <div class="mt-6 animate-fade-in-up" style="animation-delay: 0.4s">
            <button
              class="text-sm text-gray-500 hover:text-cyan-400 transition-colors font-mono tracking-wide"
              data-testid="cta-guest"
              @click="startGuestMode"
            >
              Continue as Guest
            </button>
            <p class="text-xs text-gray-600 mt-1">Data stays in your browser. No account needed.</p>
          </div>
          <p class="mt-10 animate-fade-in-up" style="animation-delay: 0.5s">
            <SharedSourceLink
              class="text-xs font-mono tracking-wide text-gray-500 hover:text-cyan-400"
              data-testid="hero-source"
            >
              Open source &middot; read the code on GitHub
            </SharedSourceLink>
          </p>
        </div>
      </div>

      <!-- Returning user dashboard -->
      <div v-else data-testid="dashboard">
        <!-- Loading state -->
        <div v-if="loading" data-testid="loading" class="flex items-center justify-center py-16">
          <div class="relative w-12 h-12">
            <div class="absolute inset-0 rounded-full border border-cyan-400/30"></div>
            <div class="absolute inset-0 rounded-full border border-cyan-400 border-t-transparent animate-spin"></div>
          </div>
          <p class="text-gray-500 ml-4 font-mono text-sm">Loading status...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" data-testid="error">
          <p class="p-3 rounded-sm bg-red-950/50 border border-red-400/20 text-red-400 text-sm font-mono">
            {{ error }}
          </p>
        </div>

        <!-- Dashboard content -->
        <div v-else-if="status" data-testid="status">
          <!-- Next action — the clear focal point -->
          <div v-if="nextStep" class="text-center py-8 sm:py-14 animate-fade-in-up" data-testid="next-step">
            <p class="font-mono text-xs text-gray-500 tracking-[0.2em] uppercase mb-5">Next step</p>
            <h1 class="text-3xl sm:text-4xl font-bold mb-3 text-glow-cyan">
              {{ nextStep.label }}
            </h1>
            <p class="text-gray-400 mb-8 max-w-md mx-auto">{{ nextStep.description }}</p>
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <UButton :to="nextStep.path" size="xl" color="primary" class="w-full sm:w-auto glow-cyan pulse-glow" data-testid="next-step-button">
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

          <!-- Reconsolidation window clock -->
          <div v-if="status.activeModule" class="mb-8 animate-fade-in-up" style="animation-delay: 0.05s" data-testid="reconsolidation">
            <SharedReconsolidationClock :active-module="status.activeModule" />
          </div>

          <!-- Compact horizontal progress stepper -->
          <div class="flex items-center justify-center gap-2 sm:gap-3 flex-wrap py-5 mb-8 border-t border-b border-gray-800/60 animate-fade-in-up" style="animation-delay: 0.1s" data-testid="progress-steps">
            <template v-if="screeningEnabled">
              <div class="flex items-center gap-1.5">
                <span
                  class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
                  :class="status.screeningComplete
                    ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                    : 'bg-gray-800 text-gray-500 border border-gray-700'"
                >
                  {{ status.screeningComplete ? '\u2713' : '1' }}
                </span>
                <span class="text-xs font-mono" :class="status.screeningComplete ? 'text-green-400/80' : 'text-gray-600'">Screening</span>
              </div>
              <span class="text-gray-700 text-xs">&mdash;</span>
            </template>

            <div class="flex items-center gap-1.5">
              <span
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
                :class="status.preparationComplete
                  ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'"
              >
                {{ status.preparationComplete ? '\u2713' : (screeningEnabled ? '2' : '1') }}
              </span>
              <span class="text-xs font-mono" :class="status.preparationComplete ? 'text-green-400/80' : 'text-gray-600'">Preparation</span>
            </div>
            <span class="text-gray-700 text-xs">&mdash;</span>

            <div class="flex items-center gap-1.5">
              <span
                class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
                :class="status.activeModule
                  ? 'bg-green-400/20 text-green-400 border border-green-400/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'"
              >
                {{ status.activeModule ? '\u2713' : (screeningEnabled ? '3' : '2') }}
              </span>
              <span class="text-xs font-mono" :class="status.activeModule ? 'text-green-400/80' : 'text-gray-600'">Triage</span>
            </div>

            <template v-if="status.activeModule">
              <span class="text-gray-700 text-xs">&mdash;</span>
              <div class="flex items-center gap-1.5">
                <span class="w-5 h-5 rounded-full flex items-center justify-center bg-cyan-400/15 border border-cyan-400/30">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px] shadow-cyan-400"></span>
                </span>
                <span class="text-xs font-mono text-cyan-400" data-testid="active-module-label">
                  {{ moduleLabels[status.activeModule] || status.activeModule }}
                </span>
              </div>
            </template>
          </div>

          <!-- Recent sessions -->
          <div class="animate-fade-in-up" style="animation-delay: 0.15s" data-testid="recent-sessions">
            <h2 class="text-sm font-mono text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span class="w-1 h-1 rounded-full bg-cyan-400"></span>
              Recent Sessions
            </h2>
            <div v-if="status.recentSessions.length === 0" class="text-gray-600 text-sm font-mono p-4 border border-gray-800/50 rounded-sm bg-surface/30">
              > No sessions recorded yet._
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="session in status.recentSessions"
                :key="session.id"
                class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-sm border border-gray-700/50 bg-surface/30 hover:border-gray-600/50 transition-colors"
              >
                <div>
                  <span class="font-medium">{{ moduleLabels[session.module] || session.module }}</span>
                  <span v-if="session.startedAt" class="block sm:inline text-sm text-gray-500 font-mono sm:ml-2">
                    {{ new Date(session.startedAt).toLocaleDateString() }}
                  </span>
                </div>
                <!-- LED status badges -->
                <span
                  v-if="session.completed"
                  class="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider px-2 py-0.5 rounded-sm bg-green-400/10 border border-green-400/20 text-green-400"
                  data-testid="badge-completed"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px] shadow-green-400"></span>
                  COMPLETED
                </span>
                <span
                  v-else-if="session.aborted"
                  class="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider px-2 py-0.5 rounded-sm bg-red-400/10 border border-red-400/20 text-red-400"
                  data-testid="badge-aborted"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_4px] shadow-red-400"></span>
                  ABORTED
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider px-2 py-0.5 rounded-sm bg-yellow-400/10 border border-yellow-400/20 text-yellow-400"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_4px] shadow-yellow-400 animate-[led-blink_2s_ease-in-out_infinite]"></span>
                  IN PROGRESS
                </span>
              </div>
            </div>
            <div v-if="status.recentSessions.length > 0" class="mt-3">
              <UButton to="/progress" variant="ghost" color="neutral" size="sm" class="text-gray-500 hover:text-cyan-400">
                View Full Progress &rarr;
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- SSR fallback — prevents hydration mismatch from localStorage-based guest detection -->
      <template #fallback>
        <div class="py-16 flex justify-center">
          <div class="relative w-12 h-12">
            <div class="absolute inset-0 rounded-full border border-cyan-400/30"></div>
            <div class="absolute inset-0 rounded-full border border-cyan-400 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
