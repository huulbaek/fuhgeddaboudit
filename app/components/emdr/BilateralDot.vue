<script setup lang="ts">
import { usePrecisionTimer } from '../../composables/usePrecisionTimer'

const props = withDefaults(
  defineProps<{
    speedMs?: number
  }>(),
  {
    speedMs: 1000,
  },
)

const emit = defineEmits<{
  pass: []
}>()

const position = ref(0)
const running = ref(false)

const timer = usePrecisionTimer()

let lastPassCount = 0

timer.onTick((elapsed) => {
  if (!running.value) return
  // Full cycle = 2 * speedMs (left-to-right + right-to-left)
  const cycleMs = props.speedMs * 2
  const phase = (elapsed % cycleMs) / cycleMs
  // Triangle wave: 0→1→0 over one full cycle
  position.value = phase < 0.5 ? phase * 2 : 2 - phase * 2

  // Emit 'pass' at each direction change (every speedMs)
  const passCount = Math.floor(elapsed / props.speedMs)
  if (passCount > lastPassCount) {
    lastPassCount = passCount
    emit('pass')
  }
})

function start() {
  lastPassCount = 0
  position.value = 0
  running.value = true
  timer.start()
}

function stop() {
  running.value = false
  timer.stop()
}

onUnmounted(() => {
  stop()
})

defineExpose({ start, stop, position, running })
</script>

<template>
  <div
    class="relative w-full h-24 bg-gray-900 rounded-xl overflow-hidden"
    role="img"
    aria-label="Bilateral stimulation dot"
  >
    <!-- Track line -->
    <div class="absolute top-1/2 left-4 right-4 h-px bg-gray-700 -translate-y-1/2" />

    <!-- Animated dot -->
    <div
      class="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50"
      :style="{ left: `calc(16px + ${position} * (100% - 56px))` }"
      :class="{ 'opacity-0': !running }"
      data-testid="bilateral-dot"
    />
  </div>
</template>
