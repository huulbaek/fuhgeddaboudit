<script setup lang="ts">
import { usePulseMonitor } from '../../composables/usePulseMonitor'
import { useGrounding } from '../../composables/useGrounding'
import { QUALITY_GOOD } from '../../utils/ppg'

const STORAGE_KEY = 'pulse-monitor-enabled'
const GROUNDING_CONTEXT = 'heart-rate-elevated'

const route = useRoute()
// WebGazer owns the camera during TNT sessions.
const hidden = computed(() => route.path.startsWith('/modules/tnt'))

const monitor = usePulseMonitor()
const grounding = useGrounding()
const enabled = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writePreference(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Per-browser convenience only
  }
}

async function toggle() {
  enabled.value = !enabled.value
  writePreference(enabled.value)
  if (enabled.value) await monitor.start()
  else monitor.stop()
}

onMounted(() => {
  if (!hidden.value && readPreference()) {
    enabled.value = true
    monitor.start()
  }
})

onBeforeUnmount(() => {
  monitor.stop()
})

watch(monitor.elevated, (isElevated, wasElevated) => {
  if (isElevated && !wasElevated && !grounding.isGrounding.value) {
    grounding.trigger(GROUNDING_CONTEXT)
  }
})

watch(monitor.waveform, (wave) => drawWaveform(wave))

function drawWaveform(wave: Float64Array) {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || wave.length < 2) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  let peak = 0
  for (let i = 0; i < wave.length; i++) peak = Math.max(peak, Math.abs(wave[i]!))
  const scale = peak > 0 ? (height / 2 - 2) / peak : 0
  ctx.beginPath()
  for (let i = 0; i < wave.length; i++) {
    const x = (i / (wave.length - 1)) * width
    const y = height / 2 - wave[i]! * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = monitor.elevated.value ? '#fbbf24' : '#22d3ee'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

const signalGood = computed(() => monitor.quality.value >= QUALITY_GOOD)
const bpmText = computed(() => (monitor.bpm.value === null ? '--' : String(Math.round(monitor.bpm.value))))
const showReadout = computed(
  () => enabled.value && (monitor.status.value === 'acquiring' || monitor.status.value === 'running'),
)

const errorLabel = computed(() => {
  switch (monitor.error.value) {
    case 'permission-denied':
      return 'Camera denied'
    case 'unsupported':
      return 'Camera unsupported'
    default:
      return 'Camera error'
  }
})

const label = computed(() => {
  switch (monitor.status.value) {
    case 'off':
      return 'Pulse ○'
    case 'starting':
      return 'Pulse …'
    case 'acquiring':
      return 'Pulse ~'
    case 'error':
      return errorLabel.value
    default:
      return monitor.elevated.value ? 'Elevated' : 'Pulse ●'
  }
})
</script>

<template>
  <div
    v-if="!hidden"
    data-testid="pulse-monitor"
    class="fixed bottom-14 right-3 z-40 font-mono text-xs select-none"
  >
    <div
      class="rounded-sm border bg-surface/80 backdrop-blur px-3 py-2 min-w-[8.5rem] transition-colors"
      :class="monitor.elevated.value ? 'border-amber-400/60 text-amber-300' : 'border-cyan-400/30 text-cyan-300'"
    >
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="tracking-widest uppercase hover:text-white transition-colors"
          data-testid="pulse-toggle"
          :aria-pressed="enabled"
          :title="enabled ? 'Switch pulse monitor off' : 'Estimate heart rate from the webcam'"
          @click="toggle"
        >
          {{ label }}
        </button>
        <span
          v-if="showReadout"
          class="inline-block w-2 h-2 rounded-full"
          :class="signalGood ? 'bg-cyan-400' : 'bg-amber-400'"
          :title="signalGood ? 'Good signal' : 'Weak signal'"
          data-testid="pulse-quality"
        />
      </div>

      <div v-if="showReadout" class="mt-1">
        <div class="flex items-baseline gap-1">
          <span class="text-2xl tabular-nums" :class="signalGood ? '' : 'opacity-50'" data-testid="pulse-bpm">{{ bpmText }}</span>
          <span class="opacity-60">bpm est.</span>
        </div>
        <canvas ref="canvasRef" width="120" height="28" class="block w-full mt-1" aria-hidden="true" />
        <p v-if="monitor.status.value === 'acquiring'" class="opacity-60 mt-1">Center your face, hold still</p>
      </div>

      <p v-if="monitor.status.value === 'error'" class="opacity-70 mt-1">Click to switch off</p>
    </div>
  </div>
</template>
