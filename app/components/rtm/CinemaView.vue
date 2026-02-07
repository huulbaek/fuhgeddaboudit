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
    durationMs: 45000,
    startLabel: 'A',
    endLabel: 'B',
  },
)

const emit = defineEmits<{
  complete: []
}>()

const progress = ref(0)
const completed = ref(false)
const running = ref(false)

const timer = usePrecisionTimer()
const audio = useAudioEngine()

let projectorAudio: { stop: () => void } | null = null

timer.onTick((elapsed) => {
  if (completed.value) return
  const fraction = Math.min(elapsed / props.durationMs, 1)
  progress.value = fraction

  if (fraction >= 1) {
    completed.value = true
    running.value = false
    timer.stop()
    stopAudio()
    emit('complete')
  }
})

const formatRemaining = computed(() => {
  const remainingMs = Math.max(props.durationMs * (1 - progress.value), 0)
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }
  return `${seconds}s`
})

function startAudio() {
  projectorAudio = audio.createBinauralBeat(80)
}

function stopAudio() {
  if (projectorAudio) {
    projectorAudio.stop()
    projectorAudio = null
  }
}

function start() {
  completed.value = false
  progress.value = 0
  running.value = true
  startAudio()
  timer.start()
}

function stop() {
  running.value = false
  timer.stop()
  stopAudio()
}

onUnmounted(() => {
  stop()
})

defineExpose({ start, stop, progress, completed, running })
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-xl bg-gray-900"
    role="region"
    aria-label="Cinema forward pass"
  >
    <!-- Film grain overlay -->
    <div class="cinema-grain absolute inset-0 z-10 pointer-events-none opacity-40" />

    <!-- Main cinema view -->
    <div class="relative z-0 p-8 min-h-[200px] flex flex-col justify-between grayscale">
      <!-- Image labels -->
      <div class="flex justify-between text-sm text-gray-400 mb-4">
        <span class="font-medium">{{ startLabel }}</span>
        <span class="font-medium">{{ endLabel }}</span>
      </div>

      <!-- Progress bar A→B -->
      <div
        role="progressbar"
        :aria-valuenow="Math.round(progress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Forward pass progress"
        class="w-full"
      >
        <div class="h-4 rounded-full bg-gray-700 overflow-hidden">
          <div
            class="h-full rounded-full bg-gray-300 transition-none"
            :style="{ width: `${progress * 100}%` }"
          />
        </div>
      </div>

      <!-- Time remaining -->
      <div class="mt-4 text-center text-xs text-gray-500">
        {{ formatRemaining }}
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-5%, -10%); }
  20% { transform: translate(-15%, 5%); }
  30% { transform: translate(7%, -25%); }
  40% { transform: translate(-5%, 25%); }
  50% { transform: translate(-15%, 10%); }
  60% { transform: translate(15%, 0%); }
  70% { transform: translate(0%, 15%); }
  80% { transform: translate(3%, 35%); }
  90% { transform: translate(-10%, 10%); }
}

.cinema-grain {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E");
  background-size: 256px 256px;
  animation: grain 0.5s steps(6) infinite;
}
</style>
