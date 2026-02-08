<script setup lang="ts">
definePageMeta({ layout: 'session' })

const SET_DURATION_MS = 30_000 // 30 seconds of bilateral stimulation per set
const RESOURCE_SETS = 2 // First N sets use resource (safe) memory
const ABREACTION_THRESHOLD = 8 // SUDs > 8 triggers grounding

const route = useRoute()
const sessionId = computed(() => route.query.sessionId as string)

type Phase = 'bilateral' | 'check-in' | 'rating' | 'complete' | 'grounded'

const phase = ref<Phase>('bilateral')
const error = ref('')
const saving = ref(false)

const currentSet = ref(1)
const checkInResponse = ref('')
const setsCompleted = ref(0)

const suds = useSuds(sessionId.value)
const grounding = useGrounding()

// Component refs
const bilateralDotRef = ref<{ start: () => void; stop: () => void } | null>(null)
const timerRef = ref<{ start: () => void; stop: () => void } | null>(null)

// Determine whether current set uses resource memory or target memory
const isResourceSet = computed(() => currentSet.value <= RESOURCE_SETS)

const setInstruction = computed(() => {
  if (isResourceSet.value) {
    return 'Follow the dot with your eyes while holding your safe memory in mind.'
  }
  return 'Follow the dot with your eyes while gently allowing the target memory to come to mind.'
})

const setTypeLabel = computed(() => {
  return isResourceSet.value ? 'Resource' : 'Target'
})

function startBilateralSet() {
  phase.value = 'bilateral'
  checkInResponse.value = ''
  nextTick(() => {
    bilateralDotRef.value?.start()
    timerRef.value?.start()
  })
}

function onTimerComplete() {
  bilateralDotRef.value?.stop()
  setsCompleted.value++
  phase.value = 'check-in'
}

function continueAfterCheckIn() {
  // After check-in, show SUDs rating
  phase.value = 'rating'
}

async function onSudsSelect(rating: number) {
  saving.value = true
  error.value = ''

  try {
    await suds.submitRating(rating, `post-set-${currentSet.value}`)

    // Abreaction monitor: SUDs > 8 triggers grounding
    if (rating > ABREACTION_THRESHOLD) {
      grounding.trigger('emdr-abreaction')
      try {
        await $fetch(`/api/sessions/${sessionId.value}`, {
          method: 'PATCH',
          body: { aborted: true, abortReason: 'user_panic' },
        })
      } catch {
        // Best-effort save
      }
      phase.value = 'grounded'
      return
    }

    // SUDs low enough — offer to continue or end
    currentSet.value++
    startBilateralSet()
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save rating'
  } finally {
    saving.value = false
  }
}

async function endSession() {
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/sessions/${sessionId.value}`, {
      method: 'PATCH',
      body: { completed: true },
    })
    phase.value = 'complete'
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save session'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!sessionId.value) {
    navigateTo('/modules/emdr/setup')
    return
  }
  nextTick(() => {
    startBilateralSet()
  })
})

onBeforeUnmount(() => {
  bilateralDotRef.value?.stop()
  timerRef.value?.stop()
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-2 sm:px-4 py-5 sm:py-8">
    <h1 class="text-2xl font-bold mb-2">EMDR Session</h1>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Bilateral stimulation phase -->
    <div v-if="phase === 'bilateral'" data-testid="bilateral-phase" class="space-y-4">
      <SharedPhaseIndicator :label="`Set ${currentSet} — ${setTypeLabel}`" :current="currentSet" :total="currentSet" />

      <div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {{ setInstruction }}
        </p>
        <p class="text-xs text-gray-400 dark:text-gray-500">
          Keep breathing slowly and naturally.
        </p>
      </div>

      <EmdrBilateralDot
        ref="bilateralDotRef"
        :speed-ms="1000"
        :audio-enabled="true"
        :tone-frequency="440"
      />

      <SharedTimerBar
        ref="timerRef"
        :duration-ms="SET_DURATION_MS"
        @complete="onTimerComplete"
      />
    </div>

    <!-- Check-in phase -->
    <div v-if="phase === 'check-in'" data-testid="checkin-phase" class="space-y-6">
      <SharedPhaseIndicator :label="`Check-in — Set ${currentSet}`" :current="currentSet" :total="currentSet" />

      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">What do you notice?</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Take a moment to observe what you're experiencing. Any thoughts, feelings,
          body sensations, or images that come up.
        </p>
        <textarea
          v-model="checkInResponse"
          rows="3"
          placeholder="Describe what you notice... (stays on your device)"
          class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="checkin-input"
        />
      </div>

      <div class="flex flex-col sm:flex-row items-stretch gap-3">
        <button
          type="button"
          class="w-full sm:flex-1 py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="checkin-continue"
          @click="continueAfterCheckIn"
        >
          Continue
        </button>
        <button
          type="button"
          class="w-full sm:w-auto py-3 px-4 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="end-session-btn"
          :disabled="saving"
          @click="endSession"
        >
          End Session
        </button>
      </div>
    </div>

    <!-- SUDs rating phase -->
    <div v-if="phase === 'rating'" data-testid="rating-phase" class="space-y-6">
      <SharedPhaseIndicator label="Distress Check" :current="currentSet" :total="currentSet" />

      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-3">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Rate your current level of distress before continuing to the next set.
        </p>
      </div>

      <SharedSudsScale :disabled="saving" @select="onSudsSelect" />

      <button
        type="button"
        class="w-full py-3 px-4 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        data-testid="end-session-rating-btn"
        :disabled="saving"
        @click="endSession"
      >
        End Session Instead
      </button>
    </div>

    <!-- Grounded (abreaction triggered) -->
    <div v-if="phase === 'grounded'" data-testid="grounded-phase" class="text-center py-10 sm:py-12 space-y-6">
      <div class="text-5xl">&#x1F49A;</div>
      <h2 class="text-xl font-semibold">Session Paused</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Your distress level was high, so we've activated the grounding exercise.
        Take all the time you need. This session has been saved.
      </p>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
        <button
          class="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          @click="navigateTo('/progress')"
        >
          View Progress
        </button>
        <button
          class="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          @click="navigateTo('/')"
        >
          Dashboard
        </button>
      </div>
    </div>

    <!-- Completion phase -->
    <div v-if="phase === 'complete'" data-testid="complete-phase" class="text-center py-10 sm:py-12 space-y-6">
      <div class="text-5xl">&#10003;</div>
      <h2 class="text-xl font-semibold">Session Complete</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        You completed {{ setsCompleted }} set{{ setsCompleted === 1 ? '' : 's' }} of bilateral stimulation.
        Your session data and distress ratings have been recorded.
      </p>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
        <button
          class="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          @click="navigateTo('/progress')"
        >
          View Progress
        </button>
        <button
          class="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          @click="navigateTo('/')"
        >
          Dashboard
        </button>
      </div>
    </div>
  </div>
</template>
