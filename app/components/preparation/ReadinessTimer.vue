<script setup lang="ts">
const emit = defineEmits<{
  success: []
  retry: []
}>()

const HOLD_DURATION_MS = 30_000

const timer = usePrecisionTimer()
const elapsedMs = ref(0)
const state = ref<'idle' | 'holding' | 'passed' | 'released'>('idle')

// Breathing pacer: 4s in, 4s out = 8s cycle
const breathPhase = computed(() => {
  if (state.value !== 'holding') return 0
  const cycleMs = 8000
  const pos = (elapsedMs.value % cycleMs) / cycleMs
  // 0→0.5 = inhale (scale 0→1), 0.5→1 = exhale (scale 1→0)
  return pos <= 0.5 ? pos * 2 : (1 - pos) * 2
})

const breathLabel = computed(() => {
  if (state.value !== 'holding') return ''
  const cycleMs = 8000
  const pos = (elapsedMs.value % cycleMs) / cycleMs
  return pos <= 0.5 ? 'Breathe in...' : 'Breathe out...'
})

const progress = computed(() => {
  return Math.min(elapsedMs.value / HOLD_DURATION_MS, 1)
})

const secondsRemaining = computed(() => {
  return Math.max(0, Math.ceil((HOLD_DURATION_MS - elapsedMs.value) / 1000))
})

const removeTick = ref<(() => void) | null>(null)

function startHold() {
  if (state.value === 'passed') return
  state.value = 'holding'
  elapsedMs.value = 0

  removeTick.value = timer.onTick((ms: number) => {
    elapsedMs.value = ms
    if (ms >= HOLD_DURATION_MS) {
      timer.stop()
      state.value = 'passed'
      emit('success')
    }
  })

  timer.start()
}

function releaseHold() {
  if (state.value !== 'holding') return
  timer.stop()
  if (removeTick.value) {
    removeTick.value()
    removeTick.value = null
  }
  state.value = 'released'
  emit('retry')
}

function tryAgain() {
  state.value = 'idle'
  elapsedMs.value = 0
}

onBeforeUnmount(() => {
  timer.stop()
  if (removeTick.value) {
    removeTick.value()
  }
})
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg sm:text-xl font-semibold">Readiness Check</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Close your eyes, go to your safe place, and feel the calm settle in.
      When you're ready, press and hold the button below for 30 seconds.
    </p>

    <!-- Breathing pacer -->
    <div
      v-if="state === 'holding'"
      class="flex flex-col items-center space-y-3"
    >
      <div
        class="rounded-full bg-emerald-200 dark:bg-emerald-800 transition-transform duration-300 ease-in-out"
        :style="{
          width: `${72 + breathPhase * 48}px`,
          height: `${72 + breathPhase * 48}px`,
        }"
      />
      <p class="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
        {{ breathLabel }}
      </p>
    </div>

    <!-- Progress ring / timer display -->
    <div class="flex flex-col items-center space-y-4">
      <div
        v-if="state === 'holding'"
        class="text-center"
      >
        <p class="text-2xl sm:text-3xl font-bold tabular-nums">
          {{ secondsRemaining }}s
        </p>
        <div class="w-full max-w-xs sm:max-w-sm h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
          <div
            class="h-full bg-emerald-500 rounded-full transition-all duration-100"
            :style="{ width: `${progress * 100}%` }"
          />
        </div>
      </div>

      <!-- Idle state -->
      <div v-if="state === 'idle'" class="text-center space-y-4">
        <UButton
          class="w-full sm:w-auto"
          size="lg"
          color="primary"
          @mousedown="startHold"
          @mouseup="releaseHold"
          @mouseleave="releaseHold"
          @touchstart.prevent="startHold"
          @touchend.prevent="releaseHold"
          @touchcancel.prevent="releaseHold"
        >
          Press & Hold When Calm
        </UButton>
      </div>

      <!-- Holding state -->
      <div v-else-if="state === 'holding'" class="text-center">
        <UButton
          class="w-full sm:w-auto"
          size="lg"
          color="primary"
          @mouseup="releaseHold"
          @mouseleave="releaseHold"
          @touchend.prevent="releaseHold"
          @touchcancel.prevent="releaseHold"
        >
          Keep Holding...
        </UButton>
      </div>

      <!-- Released early -->
      <div v-else-if="state === 'released'" class="text-center space-y-4">
        <p class="text-sm sm:text-base text-gray-600 dark:text-gray-300">
          You released early. Take a moment, breathe, and try again when you feel ready.
        </p>
        <UButton
          class="w-full sm:w-auto"
          size="lg"
          color="neutral"
          variant="outline"
          @click="tryAgain"
        >
          Try Again
        </UButton>
      </div>

      <!-- Passed -->
      <div v-else-if="state === 'passed'" class="text-center space-y-4">
        <p class="text-sm sm:text-base text-emerald-700 dark:text-emerald-300 font-medium">
          Well done. You held your calm state for 30 seconds. You're ready.
        </p>
      </div>
    </div>
  </div>
</template>
