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
    class="relative w-full overflow-hidden rounded-sm bg-gray-900 border border-gray-700/30"
    role="region"
    aria-label="Cinema forward pass"
  >
    <!-- Vignette overlay -->
    <div class="cinema-vignette absolute inset-0 z-20 pointer-events-none" />

    <!-- Film grain overlay -->
    <div class="cinema-grain absolute inset-0 z-10 pointer-events-none opacity-30" />

    <!-- Sprocket holes (decorative) -->
    <div class="absolute left-0 top-0 bottom-0 w-6 z-10 flex flex-col justify-around items-center pointer-events-none">
      <div v-for="i in 5" :key="`l-${i}`" class="w-3 h-2 rounded-sm bg-gray-800 border border-gray-700/30"></div>
    </div>
    <div class="absolute right-0 top-0 bottom-0 w-6 z-10 flex flex-col justify-around items-center pointer-events-none">
      <div v-for="i in 5" :key="`r-${i}`" class="w-3 h-2 rounded-sm bg-gray-800 border border-gray-700/30"></div>
    </div>

    <!-- Main cinema view -->
    <div class="relative z-0 p-4 sm:p-8 ml-6 mr-6 min-h-[160px] sm:min-h-[200px] flex flex-col justify-between cinema-tint">
      <!-- Image labels -->
      <div class="flex justify-between text-xs sm:text-sm text-gray-400 font-mono tracking-wider mb-4">
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
        <div class="h-3 sm:h-4 rounded-sm bg-gray-800 overflow-hidden border border-gray-700/30">
          <div
            class="h-full bg-gray-400 transition-none relative"
            :style="{ width: `${progress * 100}%` }"
          >
            <div class="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-gray-200/80 to-transparent"></div>
          </div>
        </div>
      </div>

      <!-- Time remaining -->
      <div class="mt-4 text-center text-xs text-gray-500 font-mono tracking-wider">
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

.cinema-vignette {
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.6) 100%);
}

.cinema-tint {
  filter: grayscale(1) sepia(0.15) brightness(0.9);
}
</style>
