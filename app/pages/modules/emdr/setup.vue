<script setup lang="ts">
definePageMeta({ layout: 'session' })

const BREATHING_DURATION_MS = 60 * 1000 // 60 seconds of stabilization

type Phase = 'device-check' | 'resource-install' | 'breathing' | 'navigating'

const phase = ref<Phase>('device-check')
const error = ref('')

// Device check
const screenTooSmall = ref(false)
const deviceCheckDismissed = ref(false)

// Resource installation
const safeMemoryDescription = ref('')

// Breathing stabilization
const breathTimer = usePrecisionTimer()
const breathElapsed = ref(0)
const breathRemoveTick = ref<(() => void) | null>(null)
const breathingTimerRef = ref<{ start: () => void; stop: () => void } | null>(null)

const breathPhase = computed(() => {
  if (phase.value !== 'breathing') return 0
  const cycleMs = 8000 // 4s in, 4s out
  const pos = (breathElapsed.value % cycleMs) / cycleMs
  return pos <= 0.5 ? pos * 2 : (1 - pos) * 2
})

const breathLabel = computed(() => {
  if (phase.value !== 'breathing') return ''
  const cycleMs = 8000
  const pos = (breathElapsed.value % cycleMs) / cycleMs
  return pos <= 0.5 ? 'Breathe in...' : 'Breathe out...'
})

const phaseNumber = computed(() => {
  switch (phase.value) {
    case 'device-check': return 1
    case 'resource-install': return 2
    case 'breathing': return 3
    case 'navigating': return 3
  }
})

const phaseLabel = computed(() => {
  switch (phase.value) {
    case 'device-check': return 'Device Check'
    case 'resource-install': return 'Resource Installation'
    case 'breathing': return 'Breathing'
    case 'navigating': return 'Breathing'
  }
})

function checkScreenSize() {
  if (typeof window !== 'undefined') {
    screenTooSmall.value = window.innerWidth < 768
  }
}

onMounted(() => {
  checkScreenSize()
})

function proceedFromDeviceCheck() {
  deviceCheckDismissed.value = true
  phase.value = 'resource-install'
}

const safeMemoryValid = computed(() => {
  return safeMemoryDescription.value.trim().length > 0
})

function proceedToBreathing() {
  // Store safe memory client-side only — never sent to server
  try {
    localStorage.setItem('emdr-safe-memory', safeMemoryDescription.value)
  } catch {
    // localStorage may be unavailable
  }
  phase.value = 'breathing'
  nextTick(() => {
    breathingTimerRef.value?.start()
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

async function onBreathingComplete() {
  stopBreathPacer()
  phase.value = 'navigating'
  error.value = ''

  try {
    const session = await $fetch('/api/sessions', {
      method: 'POST',
      body: { module: 'emdr' },
    })
    navigateTo(`/modules/emdr/session?sessionId=${(session as any).id}`)
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to create session'
    phase.value = 'breathing'
  }
}

onBeforeUnmount(() => {
  stopBreathPacer()
  breathingTimerRef.value?.stop()
})
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-2">EMDR Protocol</h1>

    <div class="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span
        :class="{
          'text-primary font-semibold': phase === 'device-check',
          'text-green-600 dark:text-green-400': phaseNumber > 1,
        }"
      >
        1. Device
      </span>
      <span>→</span>
      <span
        :class="{
          'text-primary font-semibold': phase === 'resource-install',
          'text-green-600 dark:text-green-400': phaseNumber > 2,
          'text-gray-400 dark:text-gray-600': phaseNumber < 2,
        }"
      >
        2. Resource
      </span>
      <span>→</span>
      <span
        :class="{
          'text-primary font-semibold': phase === 'breathing' || phase === 'navigating',
          'text-gray-400 dark:text-gray-600': phaseNumber < 3,
        }"
      >
        3. Breathing
      </span>
    </div>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Phase 1: Device Check -->
    <div v-if="phase === 'device-check'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="1" :total="3" />

      <div class="p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Device Check</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          EMDR requires a moving visual stimulus across your screen. A wider screen provides
          a better experience and more effective bilateral stimulation.
        </p>
      </div>

      <div
        v-if="screenTooSmall"
        class="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800"
      >
        <p class="text-amber-800 dark:text-amber-200 text-sm font-medium">
          Your screen appears to be narrower than 768px. EMDR works best on a tablet or
          desktop with a wider display. You can continue, but the experience may be less effective.
        </p>
      </div>

      <div
        v-else
        class="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
      >
        <p class="text-green-800 dark:text-green-200 text-sm font-medium">
          Your screen width is sufficient for EMDR bilateral stimulation.
        </p>
      </div>

      <button
        type="button"
        class="w-full py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        @click="proceedFromDeviceCheck"
      >
        {{ screenTooSmall ? 'Continue anyway' : 'Continue' }}
      </button>
    </div>

    <!-- Phase 2: Resource Installation -->
    <div v-if="phase === 'resource-install'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="2" :total="3" />

      <div class="p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Safe Memory Resource</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Think of a memory where you felt completely safe, calm, and happy.
          It could be a place, a moment with someone you love, or a time you felt at peace.
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Close your eyes for a moment and bring this memory fully to mind. Notice the sights,
          sounds, smells, and how your body feels. This safe memory will be your anchor during the session.
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-500">
          Your description stays on your device and is never sent to our servers.
        </p>
      </div>

      <div>
        <label for="safe-memory" class="block text-sm font-medium mb-1">
          Describe your safe memory
        </label>
        <textarea
          id="safe-memory"
          v-model="safeMemoryDescription"
          rows="3"
          placeholder="e.g. 'Sitting by the lake at sunset with my dog'"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <button
        type="button"
        :disabled="!safeMemoryValid"
        class="w-full py-3 px-4 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        :class="
          safeMemoryValid
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
        "
        @click="proceedToBreathing"
      >
        Continue
      </button>
    </div>

    <!-- Phase 3: Breathing Stabilization -->
    <div v-if="phase === 'breathing'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="3" :total="3" />

      <div class="p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Breathing Stabilization</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Take a moment to settle your breathing before we begin. Follow the pacer below.
          The session will start automatically when the timer completes.
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
        ref="breathingTimerRef"
        :duration-ms="BREATHING_DURATION_MS"
        @complete="onBreathingComplete"
      />
    </div>

    <!-- Navigating state -->
    <div v-if="phase === 'navigating'" class="text-center py-12">
      <p class="text-lg text-gray-500 dark:text-gray-400">Starting EMDR session...</p>
    </div>
  </div>
</template>
