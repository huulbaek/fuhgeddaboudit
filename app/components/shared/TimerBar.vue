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
    <div class="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
      <div
        class="h-full rounded-full bg-primary-500 transition-none"
        :style="{ width: `${progress * 100}%` }"
      />
    </div>
    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
      {{ formatRemaining }}
    </div>
  </div>
</template>
