<script setup lang="ts">
import { useReconsolidationWindow, formatRemaining, WINDOW_MS } from '../../composables/useReconsolidationWindow'

const props = defineProps<{
  activeModule?: string | null
}>()

const win = useReconsolidationWindow()

const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const visible = win.isOpen
const closing = computed(() => win.phase.value === 'closing')
const done = computed(() => win.outcome.value === 'completed')
const aborted = computed(() => win.outcome.value === 'aborted')
/** Amber urgency only applies while there is still work to do in the window. */
const urgent = computed(() => closing.value && win.outcome.value === 'none')
const showCallToAction = computed(() => !!props.activeModule && win.outcome.value === 'none')

/** Fraction of the window still remaining, 1 → 0. */
const fraction = computed(() => Math.min(1, Math.max(0, win.remainingMs.value / WINDOW_MS)))
const dashOffset = computed(() => CIRCUMFERENCE * (1 - fraction.value))

const remainingText = computed(() => formatRemaining(win.remainingMs.value))

const phaseLabel = computed(() => {
  if (done.value) return 'RECONSOLIDATION WINDOW · WORK DONE'
  if (aborted.value) return 'RECONSOLIDATION WINDOW · SESSION ENDED EARLY'
  if (closing.value) return 'RECONSOLIDATION WINDOW CLOSING'
  return 'RECONSOLIDATION WINDOW OPEN'
})

const message = computed(() => {
  if (done.value) {
    return 'Interference work is done inside this window. Rest, and sleep when you can: the updated memory re-saves as the window closes.'
  }
  if (aborted.value) {
    return 'The session ended early. That is fine. Use grounding if you need it; the window stays open if you feel ready to try again later.'
  }
  if (closing.value) {
    return 'The memory is about to re-save as it was. Finish an interference session before the window closes, and before you sleep.'
  }
  return 'The memory was recently reactivated and is open to change. Interference work is most effective while this window is open, and before you sleep.'
})

const moduleLabels: Record<string, string> = {
  tetris: 'Block Game',
  rtm: 'RTM',
  tnt: 'TNT',
  emdr: 'EMDR',
}
const moduleLabel = computed(() =>
  props.activeModule ? (moduleLabels[props.activeModule] ?? props.activeModule) : null,
)

const accent = computed(() => (urgent.value ? 'amber' : 'cyan'))

let releaseClock: (() => void) | null = null
onMounted(() => {
  win.load()
  releaseClock = win.subscribe()
})

onUnmounted(() => {
  releaseClock?.()
  releaseClock = null
})
</script>

<template>
  <div
    v-if="visible"
    data-testid="reconsolidation-clock"
    :data-phase="win.phase.value"
    :data-outcome="win.outcome.value"
    class="relative p-4 sm:p-5 rounded-sm border bg-surface/50 flex flex-col sm:flex-row items-center gap-5"
    :class="accent === 'amber' ? 'border-amber-400/30' : 'border-cyan-400/20 border-glow'"
  >
    <button
      type="button"
      data-testid="reconsolidation-dismiss"
      class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-sm text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 transition-colors"
      aria-label="Dismiss the reconsolidation clock"
      title="Dismiss"
      @click="win.clear()"
    >
      <span aria-hidden="true">&times;</span>
    </button>

    <div class="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" class="w-full h-full" aria-hidden="true">
        <circle cx="60" cy="60" :r="RADIUS" fill="none" stroke="rgba(44, 46, 70, 0.6)" stroke-width="4" />
        <circle
          data-testid="reconsolidation-arc"
          cx="60"
          cy="60"
          :r="RADIUS"
          fill="none"
          :stroke="accent === 'amber' ? '#fbbf24' : '#00d4ff'"
          stroke-width="4"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="dashOffset"
          transform="rotate(-90 60 60)"
          :style="{ filter: accent === 'amber' ? 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' : 'drop-shadow(0 0 4px rgba(0,212,255,0.5))' }"
        />
      </svg>
      <!-- The digits change every second: deliberately outside any live region -->
      <div class="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span
          data-testid="reconsolidation-remaining"
          class="font-mono text-xl font-bold tabular-nums"
          :class="accent === 'amber' ? 'text-amber-400' : 'text-cyan-400 text-glow-cyan'"
        >{{ remainingText }}</span>
        <span class="font-mono text-[10px] tracking-wider text-gray-500">REMAINING</span>
      </div>
    </div>

    <div class="flex-1 text-center sm:text-left space-y-2 pr-6 sm:pr-8">
      <!-- Only the phase label is announced; it changes at most a few times in six hours -->
      <p
        data-testid="reconsolidation-phase"
        role="status"
        aria-live="polite"
        class="font-mono text-xs tracking-[0.2em]"
        :class="accent === 'amber' ? 'text-amber-400' : 'text-cyan-400'"
      >
        {{ phaseLabel }}
      </p>
      <p class="text-sm text-gray-400">{{ message }}</p>
      <NuxtLink
        v-if="showCallToAction"
        :to="`/modules/${activeModule}/setup`"
        data-testid="reconsolidation-module-link"
        class="inline-flex items-center gap-2 font-mono text-xs tracking-wider px-3 py-1.5 rounded-sm border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
        :class="accent === 'amber'
          ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10'
          : 'border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10'"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="accent === 'amber' ? 'bg-amber-400' : 'bg-cyan-400'"></span>
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
      class="font-mono text-xs tracking-wider px-3 py-1.5 rounded-sm border border-gray-600/50 text-gray-300 hover:border-cyan-400/40 hover:text-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 transition-colors whitespace-nowrap"
      @click="win.open()"
    >
      MEMORY JUST CAME UP
    </button>
  </div>
</template>
