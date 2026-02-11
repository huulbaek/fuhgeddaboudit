<script setup lang="ts">
import type { TrialReactionLog } from '~/components/tnt/TrialRunner.vue'
import type { VigilanceLog } from '~/components/tnt/VigilanceTask.vue'
import type { Cue } from '~/composables/useTrialSequence'

definePageMeta({ layout: 'session' })

const route = useRoute()
const sessionId = computed(() => route.query.sessionId as string)

type Phase = 'instructions' | 'running' | 'rating' | 'complete'

const phase = ref<Phase>('instructions')
const error = ref('')
const saving = ref(false)

const suds = useSuds(sessionId.value)

// Load cues from localStorage (set during setup, never sent to server)
const cues = ref<Cue[]>([])

// Component refs
const trialRunner = ref<{ start: () => void; stop: () => void; reactionLogs: Ref<TrialReactionLog[]> } | null>(null)
const vigilanceTask = ref<{ start: () => void; stop: () => void; flickerLogs: Ref<VigilanceLog[]> } | null>(null)

// Eye tracking
const eyeTracking = useEyeTracking()
const eyeTrackingEnabled = ref(false)
const eyeTrackingError = ref('')

// Session stats computed from trial logs
const trialLogs = ref<TrialReactionLog[]>([])

const sessionStats = computed(() => {
  const logs = trialLogs.value
  const total = logs.length
  const thinkTrials = logs.filter(l => l.condition === 'think').length
  const noThinkTrials = logs.filter(l => l.condition === 'no-think').length
  const compliantTrials = logs.filter(l => l.compliant).length
  const compliancePct = total > 0 ? Math.round((compliantTrials / total) * 100) : 0

  const reactionTimes = logs
    .filter(l => l.reactionTimeMs !== null)
    .map(l => l.reactionTimeMs!)
  const avgReactionTimeMs = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : null

  return { total, thinkTrials, noThinkTrials, compliancePct, avgReactionTimeMs }
})

function onTrialLogged(log: TrialReactionLog) {
  trialLogs.value = [...trialLogs.value, log]
}

function onTrialsComplete(logs: TrialReactionLog[]) {
  trialLogs.value = logs
  // Stop vigilance task and eye tracking
  vigilanceTask.value?.stop()
  eyeTracking.stopMonitoring()
  phase.value = 'rating'
}

async function onSudsSelect(rating: number) {
  saving.value = true
  error.value = ''
  try {
    await suds.submitRating(rating, 'post-session')

    // Save TNT-specific session data
    await useSessionService().saveTntData(sessionId.value, {
      totalTrials: sessionStats.value.total,
      thinkTrials: sessionStats.value.thinkTrials,
      noThinkTrials: sessionStats.value.noThinkTrials,
      compliancePct: sessionStats.value.compliancePct,
      avgReactionTimeMs: sessionStats.value.avgReactionTimeMs,
    })

    // Mark session as completed
    await useSessionService().update(sessionId.value, { completed: true })

    phase.value = 'complete'
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save session'
  } finally {
    saving.value = false
  }
}

async function initEyeTracking() {
  try {
    await eyeTracking.initialize()
    eyeTrackingEnabled.value = true
  } catch {
    eyeTrackingError.value = 'Eye tracking unavailable. Continuing without gaze monitoring.'
  }
}

onMounted(() => {
  if (!sessionId.value) {
    navigateTo('/modules/tnt/setup')
    return
  }

  // Load cues from localStorage
  try {
    const stored = localStorage.getItem('tnt-cues')
    if (stored) {
      cues.value = JSON.parse(stored)
    }
  } catch {
    // localStorage may be unavailable
  }

  if (cues.value.length === 0) {
    navigateTo('/modules/tnt/setup')
    return
  }

  // Try to initialize eye tracking (non-blocking)
  initEyeTracking()
})

onBeforeUnmount(() => {
  trialRunner.value?.stop()
  vigilanceTask.value?.stop()
  eyeTracking.stopMonitoring()
})

function beginTrials() {
  phase.value = 'running'
  nextTick(() => {
    trialRunner.value?.start()
    vigilanceTask.value?.start()
    if (eyeTrackingEnabled.value) {
      eyeTracking.startMonitoring()
    }
  })
}

// Start gaze monitoring during no-think trials, stop during think trials
watch(
  () => eyeTrackingEnabled.value,
  (enabled) => {
    if (enabled && phase.value === 'running') {
      eyeTracking.startMonitoring()
    }
  },
)
</script>

<template>
  <div class="max-w-3xl mx-auto px-2 sm:px-4 py-5 sm:py-8">
    <h1 class="text-2xl font-bold mb-2">TNT Suppression Training</h1>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <p
      v-if="eyeTrackingError"
      class="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-sm"
      data-testid="eye-tracking-warning"
    >
      {{ eyeTrackingError }}
    </p>

    <!-- Eye tracking pause overlay -->
    <div
      v-if="eyeTracking.state.value.paused && phase === 'running'"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      data-testid="gaze-pause-overlay"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 text-center max-w-sm mx-3 sm:mx-4">
        <p class="text-lg font-semibold">{{ eyeTracking.state.value.pauseMessage }}</p>
      </div>
    </div>

    <!-- Instructions phase -->
    <div v-if="phase === 'instructions'" class="space-y-6" data-testid="instructions-phase">
      <div class="p-4 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-5">
        <h2 class="text-lg font-semibold">How This Session Works</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          You'll see your cue images one at a time. Each cue will have a colored border telling you what to do:
        </p>

        <div class="space-y-4">
          <div class="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800">
            <span class="mt-0.5 w-5 h-5 shrink-0 rounded border-3 border-green-500"></span>
            <div>
              <p class="text-sm font-semibold text-green-700 dark:text-green-300">Green border = "Think"</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Let the target memory come to mind. Think about it freely while the image is on screen.
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
            <span class="mt-0.5 w-5 h-5 shrink-0 rounded border-3 border-red-500"></span>
            <div>
              <p class="text-sm font-semibold text-red-700 dark:text-red-300">Red border = "No-Think"</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Block the memory from entering your mind. Focus on the image itself and push the memory away.
                If the memory slips through despite your effort, press the <kbd class="px-1.5 py-0.5 mx-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-mono">spacebar</kbd> to log it.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <span class="font-medium text-gray-700 dark:text-gray-300">Trial rhythm:</span>
            A fixation cross (+) appears briefly, then the cue image for 3 seconds, then a short blank pause before the next trial.
          </p>
          <p>
            <span class="font-medium text-gray-700 dark:text-gray-300">Attention checks:</span>
            Occasionally a yellow flicker will appear around the screen edge. Press <kbd class="px-1.5 py-0.5 mx-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-mono">spacebar</kbd> when you see it to confirm you're focused.
          </p>
          <p>
            <span class="font-medium text-gray-700 dark:text-gray-300">Total:</span>
            {{ cues.length * 12 }} trials (about {{ Math.ceil((cues.length * 12 * 4.5) / 60) }} minutes). Try to stay still and focused throughout.
          </p>
        </div>
      </div>

      <button
        type="button"
        class="w-full py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        data-testid="begin-trials-btn"
        @click="beginTrials"
      >
        I'm Ready — Start Trials
      </button>
    </div>

    <!-- Running phase: TrialRunner + VigilanceTask overlay -->
    <div v-if="phase === 'running'" class="space-y-4" data-testid="running-phase">
      <TntTrialRunner
        ref="trialRunner"
        :cues="cues"
        @trial-logged="onTrialLogged"
        @complete="onTrialsComplete"
      />

      <TntVigilanceTask
        ref="vigilanceTask"
      />
    </div>

    <!-- SUDs rating phase -->
    <div v-if="phase === 'rating'" class="space-y-6" data-testid="rating-phase">
      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Session Complete</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The trial sequence has ended. Please rate your current distress level.
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
          <div>
            <span class="text-gray-500 dark:text-gray-400">Total Trials</span>
            <p class="text-lg font-bold" data-testid="stat-total">{{ sessionStats.total }}</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Compliance</span>
            <p class="text-lg font-bold" data-testid="stat-compliance">{{ sessionStats.compliancePct }}%</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Avg Reaction</span>
            <p class="text-lg font-bold" data-testid="stat-reaction">
              {{ sessionStats.avgReactionTimeMs !== null ? `${sessionStats.avgReactionTimeMs}ms` : 'N/A' }}
            </p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Think / No-Think</span>
            <p class="text-lg font-bold" data-testid="stat-split">
              {{ sessionStats.thinkTrials }} / {{ sessionStats.noThinkTrials }}
            </p>
          </div>
        </div>
      </div>

      <SharedSudsScale :disabled="saving" @select="onSudsSelect" />
    </div>

    <!-- Completion phase -->
    <div v-if="phase === 'complete'" class="text-center py-10 sm:py-12 space-y-6" data-testid="complete-phase">
      <div class="text-5xl">&#10003;</div>
      <h2 class="text-xl font-semibold">Session Saved</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Your TNT session data and distress rating have been recorded.
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
