<script setup lang="ts">
definePageMeta({ layout: 'session' })

const LOOPS_PER_SET = 5

const route = useRoute()
const sessionId = computed(() => route.query.sessionId as string)

type Phase = 'forward' | 'rewind' | 'rating' | 'complete'

const phase = ref<Phase>('forward')
const error = ref('')
const saving = ref(false)

// Loop tracking
const currentLoop = ref(1)
const currentSet = ref(1)
const lastSudsRating = ref<number | null>(null)

const suds = useSuds(sessionId.value)

// Component refs
const cinemaView = ref<{ start: () => void; stop: () => void } | null>(null)
const rewindAnimation = ref<{ start: () => void; stop: () => void } | null>(null)

// Read image labels from the setup page (client-side only via localStorage)
const startLabel = ref('A')
const endLabel = ref('B')

onMounted(() => {
  if (!sessionId.value) {
    navigateTo('/modules/rtm/setup')
    return
  }

  // Try to read labels from localStorage (set during setup)
  try {
    const storedStart = localStorage.getItem('rtm-start-label')
    const storedEnd = localStorage.getItem('rtm-end-label')
    if (storedStart) startLabel.value = storedStart
    if (storedEnd) endLabel.value = storedEnd
  } catch {
    // localStorage may be unavailable
  }

  nextTick(() => {
    cinemaView.value?.start()
  })
})

onBeforeUnmount(() => {
  cinemaView.value?.stop()
  rewindAnimation.value?.stop()
})

const phaseLabel = computed(() => {
  if (phase.value === 'forward') return 'Forward Pass'
  if (phase.value === 'rewind') return 'Rewind'
  if (phase.value === 'rating') return 'SUDs Check'
  return 'Complete'
})

const totalPhases = computed(() => {
  // During loops: show loop progress out of LOOPS_PER_SET
  if (phase.value === 'forward' || phase.value === 'rewind') return LOOPS_PER_SET
  return LOOPS_PER_SET
})

function onForwardComplete() {
  phase.value = 'rewind'
  nextTick(() => {
    rewindAnimation.value?.start()
  })
}

function onRewindComplete() {
  if (currentLoop.value < LOOPS_PER_SET) {
    // More loops in this set
    currentLoop.value++
    phase.value = 'forward'
    nextTick(() => {
      cinemaView.value?.start()
    })
  } else {
    // Set complete — collect SUDs rating
    phase.value = 'rating'
  }
}

async function onSudsSuccess(rating: number) {
  saving.value = true
  error.value = ''
  try {
    await suds.submitRating(rating, `post-set-${currentSet.value}`)
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

async function onSudsRepeat(rating: number) {
  error.value = ''
  try {
    await suds.submitRating(rating, `post-set-${currentSet.value}`)
  } catch {
    // Best-effort rating save; continue regardless
  }
  lastSudsRating.value = rating
  currentSet.value++
  currentLoop.value = 1
  phase.value = 'forward'
  nextTick(() => {
    cinemaView.value?.start()
  })
}

async function onSudsAbort(reason: string) {
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/sessions/${sessionId.value}`, {
      method: 'PATCH',
      body: { aborted: true, abortReason: 'suds_no_change' },
    })
  } catch {
    // Best-effort save
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-2 sm:px-4 py-5 sm:py-8">
    <h1 class="text-2xl font-bold mb-2">RTM Rewind Protocol</h1>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Forward pass -->
    <div v-if="phase === 'forward'" class="space-y-4">
      <SharedPhaseIndicator :label="phaseLabel" :current="currentLoop" :total="totalPhases" />

      <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
        Set {{ currentSet }} — Loop {{ currentLoop }} of {{ LOOPS_PER_SET }}
      </p>

      <RtmCinemaView
        ref="cinemaView"
        :start-label="startLabel"
        :end-label="endLabel"
        @complete="onForwardComplete"
      />
    </div>

    <!-- Rewind pass -->
    <div v-if="phase === 'rewind'" class="space-y-4">
      <SharedPhaseIndicator :label="phaseLabel" :current="currentLoop" :total="totalPhases" />

      <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
        Set {{ currentSet }} — Loop {{ currentLoop }} of {{ LOOPS_PER_SET }}
      </p>

      <RtmRewindAnimation
        ref="rewindAnimation"
        :start-label="startLabel"
        :end-label="endLabel"
        @complete="onRewindComplete"
      />
    </div>

    <!-- SUDs rating phase -->
    <div v-if="phase === 'rating'" class="space-y-4">
      <RtmSudsRating
        :session-id="sessionId"
        :set-number="currentSet"
        :previous-rating="lastSudsRating"
        @success="onSudsSuccess"
        @repeat="onSudsRepeat"
        @abort="onSudsAbort"
      />
    </div>

    <!-- Completion phase -->
    <div v-if="phase === 'complete'" class="text-center py-10 sm:py-12 space-y-6">
      <div class="text-5xl">&#10003;</div>
      <h2 class="text-xl font-semibold">Session Complete</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Your RTM session data and distress ratings have been recorded.
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
