<script setup lang="ts">
import { usePrecisionTimer } from '../../composables/usePrecisionTimer'
import { useAudioEngine } from '../../composables/useAudioEngine'

const props = withDefaults(
  defineProps<{
    speedMs?: number
    audioEnabled?: boolean
    toneFrequency?: number
  }>(),
  {
    speedMs: 1000,
    audioEnabled: false,
    toneFrequency: 440,
  },
)

const emit = defineEmits<{
  pass: []
}>()

const position = ref(0)
const running = ref(false)

const timer = usePrecisionTimer()
const audioEngine = useAudioEngine()

let lastPassCount = 0
let oscillator: OscillatorNode | null = null
let gainNode: GainNode | null = null
let pannerNode: StereoPannerNode | null = null

timer.onTick((elapsed) => {
  if (!running.value) return
  // Full cycle = 2 * speedMs (left-to-right + right-to-left)
  const cycleMs = props.speedMs * 2
  const phase = (elapsed % cycleMs) / cycleMs
  // Triangle wave: 0→1→0 over one full cycle
  position.value = phase < 0.5 ? phase * 2 : 2 - phase * 2

  // Update stereo panning to match dot position: -1 (left) to +1 (right)
  if (pannerNode) {
    pannerNode.pan.value = position.value * 2 - 1
  }

  // Emit 'pass' at each direction change (every speedMs)
  const passCount = Math.floor(elapsed / props.speedMs)
  if (passCount > lastPassCount) {
    lastPassCount = passCount
    emit('pass')
  }
})

function startAudio() {
  if (!props.audioEnabled) return
  const ctx = audioEngine.getAudioContext()
  if (!ctx) return

  oscillator = ctx.createOscillator()
  gainNode = ctx.createGain()
  pannerNode = ctx.createStereoPanner()

  oscillator.frequency.value = props.toneFrequency
  gainNode.gain.value = 0.3

  oscillator.connect(gainNode)
  gainNode.connect(pannerNode)
  pannerNode.connect(ctx.destination)
  pannerNode.pan.value = -1 // Start panned left

  oscillator.start()
}

function stopAudio() {
  if (oscillator) {
    oscillator.stop()
    oscillator.disconnect()
    oscillator = null
  }
  if (gainNode) {
    gainNode.disconnect()
    gainNode = null
  }
  if (pannerNode) {
    pannerNode.disconnect()
    pannerNode = null
  }
}

function start() {
  lastPassCount = 0
  position.value = 0
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

defineExpose({ start, stop, position, running })
</script>

<template>
  <div
    class="relative w-full h-24 bg-gray-900 rounded-sm overflow-hidden border border-gray-700/30"
    role="img"
    aria-label="Bilateral stimulation dot"
  >
    <!-- Grid marks -->
    <div class="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
      <div v-for="i in 9" :key="i" class="w-px h-2 bg-gray-700/50"></div>
    </div>

    <!-- Track line -->
    <div class="absolute top-1/2 left-4 right-4 h-px bg-gray-700/60 -translate-y-1/2" />

    <!-- Comet trail (multiple fading copies) -->
    <template v-if="running">
      <div
        v-for="t in 4"
        :key="`trail-${t}`"
        class="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-400"
        :style="{
          left: `calc(16px + ${position} * (100% - 56px))`,
          opacity: 0.08 * (5 - t),
          filter: `blur(${t * 3}px)`,
          transform: `translateY(-50%) scale(${1 + t * 0.3})`
        }"
      />
    </template>

    <!-- Main dot -->
    <div
      class="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-cyan-400 transition-none"
      :style="{ left: `calc(16px + ${position} * (100% - 56px))` }"
      :class="running ? 'dot-glow' : 'opacity-0'"
      data-testid="bilateral-dot"
    />
  </div>
</template>

<style scoped>
.dot-glow {
  box-shadow:
    0 0 12px rgba(0, 212, 255, 0.6),
    0 0 30px rgba(0, 212, 255, 0.3),
    0 0 60px rgba(0, 212, 255, 0.1);
}
</style>
