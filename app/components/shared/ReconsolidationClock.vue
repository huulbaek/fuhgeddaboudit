<script setup lang="ts">
import { useReconsolidationWindow, formatRemaining, WINDOW_MS } from '../../composables/useReconsolidationWindow'
import { usePrecisionTimer } from '../../composables/usePrecisionTimer'

const props = defineProps<{
  activeModule?: string | null
}>()

const win = useReconsolidationWindow()
const timer = usePrecisionTimer()

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const visible = computed(() => win.phase.value === 'open' || win.phase.value === 'closing')
const closing = computed(() => win.phase.value === 'closing')

/** Fraction of the window still remaining, 1 → 0. */
const fraction = computed(() => Math.min(1, Math.max(0, win.remainingMs.value / WINDOW_MS)))
const dashOffset = computed(() => CIRCUMFERENCE * (1 - fraction.value))

const remainingText = computed(() => formatRemaining(win.remainingMs.value))

const moduleLabels: Record<string, string> = {
  tetris: 'Tetris',
  rtm: 'RTM',
  tnt: 'TNT',
  emdr: 'EMDR',
}
const moduleLabel = computed(() =>
  props.activeModule ? (moduleLabels[props.activeModule] ?? props.activeModule) : null,
)

// Re-evaluate the clock once per second, driven by the rAF timer.
let lastSecond = -1
onMounted(() => {
  win.load()
  timer.onTick(() => {
    const second = Math.floor(performance.now() / 1000)
    if (second === lastSecond) return
    lastSecond = second
    win.tick()
  })
  timer.start()
})

onUnmounted(() => {
  timer.stop()
})
</script>

<template>
  <div
    v-if="visible"
    data-testid="reconsolidation-clock"
    :data-phase="win.phase.value"
    class="p-4 sm:p-5 rounded-sm border bg-surface/50 flex flex-col sm:flex-row items-center gap-5"
    :class="closing ? 'border-amber-400/30' : 'border-cyan-400/20 border-glow'"
    role="status"
    aria-live="polite"
  >
    <div class="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" class="w-full h-full" aria-hidden="true">
        <circle cx="60" cy="60" :r="RADIUS" fill="none" stroke="rgba(44, 46, 70, 0.6)" stroke-width="4" />
        <circle
          data-testid="reconsolidation-arc"
          cx="60"
          cy="60"
          :r="RADIUS"
          fill="none"
          :stroke="closing ? '#fbbf24' : '#00d4ff'"
          stroke-width="4"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 60 60)"
          :style="{ filter: closing ? 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' : 'drop-shadow(0 0 4px rgba(0,212,255,0.5))' }"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span
          data-testid="reconsolidation-remaining"
          class="font-mono text-xl font-bold tabular-nums"
          :class="closing ? 'text-amber-400' : 'text-cyan-400 text-glow-cyan'"
        >{{ remainingText }}</span>
        <span class="font-mono text-[10px] tracking-wider text-gray-500">REMAINING</span>
      </div>
    </div>

    <div class="flex-1 text-center sm:text-left space-y-2">
      <p class="font-mono text-xs tracking-[0.2em]" :class="closing ? 'text-amber-400' : 'text-cyan-400'">
        {{ closing ? 'RECONSOLIDATION WINDOW CLOSING' : 'RECONSOLIDATION WINDOW OPEN' }}
      </p>
      <p class="text-sm text-gray-400">
        <template v-if="closing">
          The memory is about to re-save as it was. Finish an interference session before the window closes, and before you sleep.
        </template>
        <template v-else>
          The memory was recently reactivated and is open to change. Interference work is most effective while this window is open, and before you sleep.
        </template>
      </p>
      <NuxtLink
        v-if="activeModule"
        :to="`/modules/${activeModule}/setup`"
        data-testid="reconsolidation-module-link"
        class="inline-flex items-center gap-2 font-mono text-xs tracking-wider px-3 py-1.5 rounded-sm border transition-colors"
        :class="closing
          ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10'
          : 'border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="closing ? 'bg-amber-400' : 'bg-cyan-400'"></span>
        START {{ moduleLabel?.toUpperCase() }} NOW
      </NuxtLink>
    </div>
  </div>

  <div
    v-else
    class="p-3 rounded-sm border border-gray-700/40 bg-surface/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
  >
    <p class="text-xs text-gray-500 font-mono">
      > Memory came up unexpectedly? Mark it to start the 6 h reconsolidation clock._
    </p>
    <button
      type="button"
      data-testid="reconsolidation-mark"
      class="font-mono text-xs tracking-wider px-3 py-1.5 rounded-sm border border-gray-600/50 text-gray-300 hover:border-cyan-400/40 hover:text-cyan-400 transition-colors whitespace-nowrap"
      @click="win.open()"
    >
      MEMORY JUST CAME UP
    </button>
  </div>
</template>
