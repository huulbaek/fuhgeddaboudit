<script setup lang="ts">
import { usePrecisionTimer } from '../../composables/usePrecisionTimer'
import { useAudioEngine, reverseAudioBuffer } from '../../composables/useAudioEngine'
import { useVoiceRecorder } from '../../composables/useVoiceRecorder'
import { useRtmNarration } from '../../composables/useRtmNarration'

const props = withDefaults(defineProps<{ maxMs?: number }>(), { maxMs: 30_000 })

const emit = defineEmits<{
  complete: []
  skip: []
}>()

type State = 'idle' | 'starting' | 'recording' | 'processing' | 'recorded' | 'error'

const state = ref<State>('idle')
const elapsedMs = ref(0)
const supported = ref(true)

const timer = usePrecisionTimer()
const audio = useAudioEngine()
const recorder = useVoiceRecorder()
const narration = useRtmNarration()

// Forward (unreversed) copy kept only for the preview button
let forwardBuffer: AudioBuffer | null = null

onMounted(() => {
  supported.value = recorder.isSupported()
})

const secondsRemaining = computed(() =>
  Math.max(0, Math.ceil((props.maxMs - elapsedMs.value) / 1000)),
)

const recordedSeconds = computed(() =>
  forwardBuffer ? Math.round(forwardBuffer.duration) : 0,
)

const errorMessage = computed(() => {
  switch (recorder.error.value) {
    case 'permission-denied':
      return 'Microphone access was denied. You can still continue without a narration.'
    case 'unsupported':
      return "This browser doesn't support voice recording. You can continue without a narration."
    default:
      return 'Recording failed. You can try again or continue without a narration.'
  }
})

let removeTick: (() => void) | null = null

const btnPrimary =
  'w-full sm:w-auto py-3 px-5 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500'
const btnSecondary =
  'w-full sm:w-auto py-3 px-5 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500'

async function startRecording() {
  if (state.value === 'starting' || state.value === 'recording') return
  elapsedMs.value = 0
  state.value = 'starting'
  await recorder.start()
  if (state.value !== 'starting') return // unmounted or cancelled while the prompt was open
  if (recorder.error.value) {
    state.value = 'error'
    return
  }
  state.value = 'recording'
  removeTick = timer.onTick((ms) => {
    elapsedMs.value = ms
    if (ms >= props.maxMs) stopRecording()
  })
  timer.start()
}

async function stopRecording() {
  if (state.value !== 'recording') return
  state.value = 'processing'
  timer.stop()
  removeTick?.()
  removeTick = null

  const buffer = await recorder.stop()
  const ctx = audio.getAudioContext()
  if (!buffer || !ctx) {
    state.value = 'error'
    return
  }
  forwardBuffer = buffer
  narration.set(reverseAudioBuffer(buffer, ctx))
  state.value = 'recorded'
}

function reRecord() {
  narration.clear()
  forwardBuffer = null
  state.value = 'idle'
}

async function preview() {
  if (!forwardBuffer) return
  await audio.playBuffer(forwardBuffer)
}

function skip() {
  narration.clear()
  emit('skip')
}

onBeforeUnmount(() => {
  timer.stop()
  removeTick?.()
  if (state.value === 'recording' || state.value === 'starting') {
    narration.clear()
  }
  recorder.cancel()
  state.value = 'idle'
})
</script>

<template>
  <div class="space-y-6" data-testid="narration-recorder">
    <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
      <h2 class="text-lg font-semibold">Narrate the Movie</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Optional. In a few calm sentences, describe the movie from
        <strong>A</strong> to <strong>B</strong> as if you were reading the back of a DVD case.
        During each rewind you will hear your own words played backwards at high speed.
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-500">
        The recording stays in this browser tab's memory only. It is never saved to disk
        or sent anywhere, and it is gone the moment the session ends.
      </p>
    </div>

    <!-- Unsupported browser -->
    <div v-if="!supported" class="space-y-4">
      <p class="text-sm text-amber-600 dark:text-amber-400">
        This browser doesn't support voice recording. You can continue without a narration.
      </p>
      <button type="button" :class="btnSecondary" @click="skip">Skip</button>
    </div>

    <!-- Idle -->
    <div v-else-if="state === 'idle'" class="flex flex-col sm:flex-row gap-3">
      <button type="button" :class="btnPrimary" @click="startRecording">
        Record narration
      </button>
      <button type="button" :class="btnSecondary" @click="skip">Skip</button>
    </div>

    <!-- Waiting for the permission prompt -->
    <div v-else-if="state === 'starting'" class="text-center text-sm text-gray-500 dark:text-gray-400">
      Requesting microphone access...
    </div>

    <!-- Recording -->
    <div v-else-if="state === 'recording'" class="space-y-4 text-center">
      <div class="flex items-center justify-center gap-3">
        <span class="inline-block w-3 h-3 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
        <span class="font-mono text-2xl tabular-nums" data-testid="countdown">{{ secondsRemaining }}s</span>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">Recording. Speak slowly and calmly.</p>
      <button type="button" :class="btnPrimary" @click="stopRecording">Stop</button>
    </div>

    <!-- Processing -->
    <div v-else-if="state === 'processing'" class="text-center text-sm text-gray-500 dark:text-gray-400">
      Preparing your narration...
    </div>

    <!-- Recorded -->
    <div v-else-if="state === 'recorded'" class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-400 text-center">
        Recorded {{ recordedSeconds }}s of narration.
      </p>
      <div class="flex flex-col sm:flex-row gap-3">
        <button type="button" :class="btnSecondary" @click="preview">Preview</button>
        <button type="button" :class="btnSecondary" @click="reRecord">Re-record</button>
        <button type="button" :class="[btnPrimary, 'sm:ml-auto']" @click="emit('complete')">Continue</button>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="state === 'error'" class="space-y-4">
      <p class="text-sm text-amber-600 dark:text-amber-400">{{ errorMessage }}</p>
      <div class="flex flex-col sm:flex-row gap-3">
        <button
          v-if="recorder.error.value !== 'unsupported'"
          type="button"
          :class="btnSecondary"
          @click="startRecording"
        >
          Try again
        </button>
        <button type="button" :class="btnSecondary" @click="skip">Skip</button>
      </div>
    </div>
  </div>
</template>
