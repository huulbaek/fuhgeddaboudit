<script setup lang="ts">
export interface VigilanceLog {
  flickerIndex: number
  startTimeMs: number
  reactionTimeMs: number | null
  responded: boolean
}

const emit = defineEmits<{
  flickerLogged: [log: VigilanceLog]
}>()

const isActive = ref(false)
const isFlickering = ref(false)
const flickerLogs = ref<VigilanceLog[]>([])

let flickerStartTime: number | null = null
let currentFlickerIndex = 0
let flickerTimeoutId: ReturnType<typeof setTimeout> | null = null
let scheduleTimeoutId: ReturnType<typeof setTimeout> | null = null

const MIN_INTERVAL_MS = 13_000
const MAX_INTERVAL_MS = 17_000
const FLICKER_DURATION_MS = 3_000

function randomInterval(): number {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)
}

function showFlicker() {
  if (!isActive.value) return
  isFlickering.value = true
  flickerStartTime = performance.now()
  currentFlickerIndex++

  // Auto-expire the flicker after FLICKER_DURATION_MS if no response
  flickerTimeoutId = setTimeout(() => {
    if (isFlickering.value) {
      logMissedFlicker()
    }
  }, FLICKER_DURATION_MS)
}

function logMissedFlicker() {
  const log: VigilanceLog = {
    flickerIndex: currentFlickerIndex,
    startTimeMs: flickerStartTime!,
    reactionTimeMs: null,
    responded: false,
  }
  flickerLogs.value.push(log)
  emit('flickerLogged', log)
  isFlickering.value = false
  flickerStartTime = null
  scheduleNextFlicker()
}

function scheduleNextFlicker() {
  if (!isActive.value) return
  scheduleTimeoutId = setTimeout(() => {
    showFlicker()
  }, randomInterval())
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ' && isFlickering.value && flickerStartTime != null) {
    e.preventDefault()
    if (flickerTimeoutId != null) {
      clearTimeout(flickerTimeoutId)
      flickerTimeoutId = null
    }
    const reactionTimeMs = Math.round(performance.now() - flickerStartTime)
    const log: VigilanceLog = {
      flickerIndex: currentFlickerIndex,
      startTimeMs: flickerStartTime,
      reactionTimeMs,
      responded: true,
    }
    flickerLogs.value.push(log)
    emit('flickerLogged', log)
    isFlickering.value = false
    flickerStartTime = null
    scheduleNextFlicker()
  }
}

function start() {
  isActive.value = true
  flickerLogs.value = []
  currentFlickerIndex = 0
  flickerStartTime = null
  scheduleNextFlicker()
}

function stop() {
  isActive.value = false
  isFlickering.value = false
  flickerStartTime = null
  if (flickerTimeoutId != null) {
    clearTimeout(flickerTimeoutId)
    flickerTimeoutId = null
  }
  if (scheduleTimeoutId != null) {
    clearTimeout(scheduleTimeoutId)
    scheduleTimeoutId = null
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stop()
})

defineExpose({ start, stop, showFlicker, flickerLogs })
</script>

<template>
  <div
    v-if="isActive"
    class="fixed inset-0 pointer-events-none z-50 transition-all duration-100"
    :class="isFlickering ? 'border-8 border-yellow-400 animate-pulse' : ''"
    data-testid="vigilance-overlay"
    role="alert"
    :aria-label="isFlickering ? 'Attention check — press spacebar' : undefined"
  >
    <div
      v-if="isFlickering"
      class="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-full pointer-events-none select-none text-center whitespace-nowrap"
      data-testid="vigilance-prompt"
    >
      Press spacebar
    </div>
  </div>
</template>
