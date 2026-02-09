<script setup lang="ts">
definePageMeta({ layout: 'session' })

const REACTIVATION_MS = 2 * 60 * 1000
const WAIT_PERIOD_MS = 2 * 60 * 1000

const phase = ref<'reactivation' | 'wait' | 'navigating'>('reactivation')
const error = ref('')

const reactivationTimer = ref<{ start: () => void; stop: () => void } | null>(null)
const waitTimer = ref<{ start: () => void; stop: () => void } | null>(null)

// Breathing pacer for wait period: 4s in, 4s out = 8s cycle
const breathTimer = usePrecisionTimer()
const breathElapsed = ref(0)
const breathRemoveTick = ref<(() => void) | null>(null)

const breathPhase = computed(() => {
  if (phase.value !== 'wait') return 0
  const cycleMs = 8000
  const pos = (breathElapsed.value % cycleMs) / cycleMs
  return pos <= 0.5 ? pos * 2 : (1 - pos) * 2
})

const breathLabel = computed(() => {
  if (phase.value !== 'wait') return ''
  const cycleMs = 8000
  const pos = (breathElapsed.value % cycleMs) / cycleMs
  return pos <= 0.5 ? 'Breathe in...' : 'Breathe out...'
})

function onReactivationComplete() {
  phase.value = 'wait'
  nextTick(() => {
    waitTimer.value?.start()
    startBreathPacer()
  })
}

function startBreathPacer() {
  breathElapsed.value = 0
  breathRemoveTick.value = breathTimer.onTick((ms: number) => {
    breathElapsed.value = ms
  })
  breathTimer.start()
}

function stopBreathPacer() {
  breathTimer.stop()
  if (breathRemoveTick.value) {
    breathRemoveTick.value()
    breathRemoveTick.value = null
  }
}

async function onWaitComplete() {
  stopBreathPacer()
  phase.value = 'navigating'
  error.value = ''

  try {
    const session = await useSessionService().create({ module: 'tetris' })
    navigateTo(`/modules/tetris/session?sessionId=${(session as any).id}`)
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to create session'
    phase.value = 'wait'
  }
}

onMounted(() => {
  reactivationTimer.value?.start()
})

onBeforeUnmount(() => {
  reactivationTimer.value?.stop()
  waitTimer.value?.stop()
  stopBreathPacer()
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-2 sm:px-4 py-5 sm:py-8">
    <div class="mb-4">
      <UButton to="/" variant="link" color="neutral" size="sm" data-testid="back-to-dashboard">
        &larr; Change Module
      </UButton>
    </div>
    <h1 class="text-2xl font-bold mb-2">Visuospatial Interference</h1>

    <div class="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
      <span
        :class="{
          'text-primary font-semibold': phase === 'reactivation',
          'text-green-600 dark:text-green-400': phase !== 'reactivation',
        }"
      >
        Phase 1: Reactivation
      </span>
      <span class="hidden sm:inline">→</span>
      <span
        :class="{
          'text-primary font-semibold': phase === 'wait' || phase === 'navigating',
          'text-gray-400 dark:text-gray-600': phase === 'reactivation',
        }"
      >
        Phase 2: Wait Period
      </span>
    </div>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Phase 1: Reactivation -->
    <div v-if="phase === 'reactivation'" class="space-y-6">
      <SharedPhaseIndicator label="Reactivation" :current="1" :total="2" />

      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Guided Memory Focus</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Bring the memory briefly to mind. Focus on the most vivid image, the strongest feeling,
          and where you feel it in your body. You don't need to hold it intensely — just let it be present.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          This reactivation step makes the memory accessible for the game session that follows.
          Stay with the memory gently. If distress becomes too high, use the panic button.
        </p>
      </div>

      <SharedTimerBar
        ref="reactivationTimer"
        :duration-ms="REACTIVATION_MS"
        @complete="onReactivationComplete"
      />
    </div>

    <!-- Phase 2: Wait Period -->
    <div v-if="phase === 'wait'" class="space-y-6">
      <SharedPhaseIndicator label="Wait Period" :current="2" :total="2" />

      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Settling Period</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The memory has been reactivated. Now relax and breathe for a few minutes before the game begins.
          Follow the breathing pacer below.
        </p>
      </div>

      <!-- Breathing pacer -->
      <div class="flex flex-col items-center space-y-3">
        <div
          class="rounded-full bg-emerald-200 dark:bg-emerald-800 transition-transform duration-300 ease-in-out"
          :style="{
            width: `${80 + breathPhase * 60}px`,
            height: `${80 + breathPhase * 60}px`,
          }"
        />
        <p class="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
          {{ breathLabel }}
        </p>
      </div>

      <SharedTimerBar
        ref="waitTimer"
        :duration-ms="WAIT_PERIOD_MS"
        @complete="onWaitComplete"
      />
    </div>

    <!-- Navigating state -->
    <div v-if="phase === 'navigating'" class="text-center py-12">
      <p class="text-lg text-gray-500 dark:text-gray-400">Starting game session...</p>
    </div>
  </div>
</template>
