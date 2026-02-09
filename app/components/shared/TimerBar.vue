<script setup lang="ts">
import { usePrecisionTimer } from '../../composables/usePrecisionTimer'

const props = defineProps<{
  durationMs: number
}>()

const emit = defineEmits<{
  complete: []
}>()

const progress = ref(0)
const completed = ref(false)
const timer = usePrecisionTimer()

timer.onTick((elapsed) => {
  if (completed.value) return
  const fraction = Math.min(elapsed / props.durationMs, 1)
  progress.value = fraction

  if (fraction >= 1) {
    completed.value = true
    timer.stop()
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

function start() {
  completed.value = false
  progress.value = 0
  timer.start()
}

function stop() {
  timer.stop()
}

onUnmounted(() => {
  timer.stop()
})

defineExpose({ start, stop, progress, completed })
</script>

<template>
  <div
    class="w-full"
    role="progressbar"
    :aria-valuenow="Math.round(progress * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="h-3 rounded-sm bg-gray-800 overflow-hidden border border-gray-700/50">
      <div
        class="h-full bg-cyan-400 transition-none relative"
        :style="{ width: `${progress * 100}%` }"
      >
        <!-- Leading edge glow -->
        <div class="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-cyan-300/80 to-transparent"></div>
      </div>
    </div>
    <div class="mt-1 text-xs text-gray-500 font-mono text-right tracking-wider">
      {{ formatRemaining }}
    </div>
  </div>
</template>
