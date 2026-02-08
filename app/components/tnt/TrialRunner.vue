<script setup lang="ts">
import type { Cue, TrialSequenceOptions, TrialLog } from '~/composables/useTrialSequence'

export interface TrialReactionLog {
  trialIndex: number
  cueId: string
  condition: 'think' | 'no-think'
  itiMs: number
  reactionTimeMs: number | null
  compliant: boolean
}

const props = defineProps<{
  cues: Cue[]
  options?: TrialSequenceOptions
}>()

const emit = defineEmits<{
  complete: [logs: TrialReactionLog[]]
  trialLogged: [log: TrialReactionLog]
}>()

const { state, start, stop, reset } = useTrialSequence(props.cues, props.options)

const reactionLogs = ref<TrialReactionLog[]>([])
let cueShownAt: number | null = null
let currentTrialReacted = false

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ' && state.value.phase === 'cue' && state.value.currentCondition === 'no-think') {
    e.preventDefault()
    currentTrialReacted = true
  }
}

// Track when cue phase begins to measure reaction time for no-think compliance
watch(
  () => state.value.phase,
  (phase) => {
    if (phase === 'cue') {
      cueShownAt = performance.now()
      currentTrialReacted = false
    }
  },
)

// When a trial is logged by useTrialSequence (during ITI), augment it with reaction data
watch(
  () => state.value.logs.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen ?? 0)) {
      const trialLog: TrialLog = state.value.logs[newLen - 1]
      const reactionLog: TrialReactionLog = {
        trialIndex: trialLog.trialIndex,
        cueId: trialLog.cueId,
        condition: trialLog.condition,
        itiMs: trialLog.itiMs,
        reactionTimeMs: currentTrialReacted && cueShownAt != null
          ? Math.round(performance.now() - cueShownAt)
          : null,
        // For no-think: compliant = did NOT react (suppressed). For think: always compliant.
        compliant: trialLog.condition === 'think' ? true : !currentTrialReacted,
      }
      reactionLogs.value.push(reactionLog)
      emit('trialLogged', reactionLog)

      cueShownAt = null
      currentTrialReacted = false
    }
  },
)

// Emit complete when sequence finishes
watch(
  () => state.value.phase,
  (phase) => {
    if (phase === 'complete') {
      emit('complete', reactionLogs.value)
    }
  },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stop()
})

function startSequence() {
  reactionLogs.value = []
  cueShownAt = null
  currentTrialReacted = false
  start()
}

function stopSequence() {
  stop()
}

defineExpose({ start: startSequence, stop: stopSequence, reset, reactionLogs })
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center min-h-[260px] sm:min-h-[320px]"
    data-testid="trial-runner"
  >
    <!-- Progress indicator -->
    <div
      v-if="state.phase !== 'idle' && state.phase !== 'complete'"
      class="absolute top-0 left-0 right-0"
    >
      <PhaseIndicator
        label="Trial"
        :current="state.currentTrialIndex + 1"
        :total="state.totalTrials"
      />
    </div>

    <!-- Fixation cross -->
    <div
      v-if="state.phase === 'fixation'"
      class="text-6xl font-bold text-gray-700 dark:text-gray-300 select-none"
      data-testid="fixation-cross"
      aria-label="Fixation cross"
    >
      +
    </div>

    <!-- Cue display -->
    <div
      v-if="state.phase === 'cue' && state.currentCue && state.currentCondition"
      data-testid="cue-display"
    >
      <CueCard
        :cue="state.currentCue"
        :condition="state.currentCondition"
      />
    </div>

    <!-- ITI blank screen -->
    <div
      v-if="state.phase === 'iti'"
      class="w-full h-full"
      data-testid="iti-blank"
      aria-label="Inter-trial interval"
    />

    <!-- Idle state -->
    <div
      v-if="state.phase === 'idle'"
      class="text-center"
      data-testid="trial-idle"
    >
      <p class="text-gray-500 dark:text-gray-400">
        Ready to begin trial sequence.
      </p>
    </div>

    <!-- Complete state -->
    <div
      v-if="state.phase === 'complete'"
      class="text-center"
      data-testid="trial-complete"
    >
      <p class="text-lg font-semibold text-green-600 dark:text-green-400">
        Sequence complete
      </p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {{ reactionLogs.length }} trials recorded
      </p>
    </div>
  </div>
</template>
