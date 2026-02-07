<script setup lang="ts">
import { usePrecisionTimer } from '../../composables/usePrecisionTimer'
import { useAudioEngine } from '../../composables/useAudioEngine'

const props = withDefaults(
  defineProps<{
    durationMs?: number
    startLabel?: string
    endLabel?: string
  }>(),
  {
    durationMs: 1500,
    startLabel: 'A',
    endLabel: 'B',
  },
)

const emit = defineEmits<{
  complete: []
}>()

const progress = ref(1) // Starts at 1 (B) and rewinds to 0 (A)
const active = ref(false)
const completed = ref(false)
const running = ref(false)

const timer = usePrecisionTimer()
const audio = useAudioEngine()

timer.onTick((elapsed) => {
  if (completed.value) return
  // Progress goes from 1 (B) to 0 (A)
  const fraction = Math.min(elapsed / props.durationMs, 1)
  progress.value = 1 - fraction

  if (fraction >= 1) {
    completed.value = true
    running.value = false
    active.value = false
    timer.stop()
    emit('complete')
  }
})

async function start() {
  completed.value = false
  progress.value = 1
  active.value = true
  running.value = true

  // Play rewind-whoosh audio with sample-accurate timing
  try {
    await audio.playImmediate('/audio/rewind-whoosh.mp3')
  } catch {
    // Audio playback is best-effort; animation must proceed regardless
  }

  timer.start()
}

function stop() {
  running.value = false
  active.value = false
  timer.stop()
}

onUnmounted(() => {
  stop()
})

defineExpose({ start, stop, progress, completed, running, active })
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-xl bg-gray-900"
    role="region"
    aria-label="Cinema rewind pass"
  >
    <!-- Main rewind view — no grayscale (hard cut to color) -->
    <div class="relative z-0 p-8 min-h-[200px] flex flex-col justify-between">
      <!-- Image labels (reversed: B on left, A on right for rewind direction) -->
      <div class="flex justify-between text-sm mb-4">
        <span class="font-medium text-amber-400">{{ endLabel }}</span>
        <span class="font-medium text-amber-400">{{ startLabel }}</span>
      </div>

      <!-- Progress bar B→A (fills right to left) -->
      <div
        role="progressbar"
        :aria-valuenow="Math.round((1 - progress) * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Rewind pass progress"
        class="w-full"
      >
        <div class="h-4 rounded-full bg-gray-700 overflow-hidden">
          <div
            class="h-full rounded-full bg-amber-400 transition-none"
            :style="{ width: `${progress * 100}%` }"
          />
        </div>
      </div>

      <!-- Rewind indicator -->
      <div class="mt-4 text-center text-xs text-amber-300">
        <span v-if="active">Rewinding...</span>
        <span v-else-if="completed">Rewind complete</span>
        <span v-else>Ready</span>
      </div>
    </div>
  </div>
</template>
