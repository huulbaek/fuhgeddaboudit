<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    durationMs?: number
  }>(),
  {
    durationMs: 30_000,
  },
)

const emit = defineEmits<{
  complete: []
}>()

type Phase = 'intro' | 'recall' | 'bilateral' | 'done'

const phase = ref<Phase>('intro')
const bilateralDotRef = ref<{ start: () => void; stop: () => void } | null>(null)
const timerRef = ref<{ start: () => void; stop: () => void } | null>(null)

const steps = [
  {
    title: 'Close your eyes and breathe',
    instruction:
      'Take a few slow, deep breaths. Let your shoulders drop. When you feel settled, open your eyes and continue.',
  },
  {
    title: 'Bring your safe memory to mind',
    instruction:
      'Think of the safe, happy memory you described earlier. Picture it vividly — the sights, sounds, smells, and feelings in your body.',
  },
  {
    title: 'Strengthen the image',
    instruction:
      'Let the feeling of calm and safety grow. Notice where you feel it most in your body. Hold this image clearly in your mind.',
  },
]

const currentStep = ref(0)

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  } else {
    startBilateral()
  }
}

function startBilateral() {
  phase.value = 'bilateral'
  nextTick(() => {
    bilateralDotRef.value?.start()
    timerRef.value?.start()
  })
}

function onTimerComplete() {
  bilateralDotRef.value?.stop()
  phase.value = 'done'
}

function finish() {
  emit('complete')
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold">Resource Installation</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      We'll strengthen your safe memory with bilateral stimulation. Follow the
      guided steps, then track the moving dot while holding your safe memory in mind.
    </p>

    <!-- Intro: guided recall steps -->
    <div v-if="phase === 'intro'" class="space-y-4">
      <div class="p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
        <p class="text-sm text-gray-400 dark:text-gray-500">
          Step {{ currentStep + 1 }} of {{ steps.length }}
        </p>
        <h3 class="text-lg font-medium">{{ steps[currentStep]!.title }}</h3>
        <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
          {{ steps[currentStep]!.instruction }}
        </p>
      </div>

      <button
        type="button"
        class="w-full py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        data-testid="step-button"
        @click="nextStep"
      >
        {{ currentStep < steps.length - 1 ? 'Continue' : 'Begin Bilateral Tapping' }}
      </button>
    </div>

    <!-- Bilateral stimulation phase -->
    <div v-if="phase === 'bilateral'" class="space-y-4">
      <div class="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
          Follow the dot with your eyes while holding your safe memory in mind.
        </p>
        <p class="text-xs text-gray-400 dark:text-gray-500">
          Keep breathing slowly and naturally.
        </p>
      </div>

      <EmdrBilateralDot
        ref="bilateralDotRef"
        :speed-ms="1000"
        :audio-enabled="true"
        :tone-frequency="440"
      />

      <SharedTimerBar
        ref="timerRef"
        :duration-ms="props.durationMs"
        @complete="onTimerComplete"
      />
    </div>

    <!-- Completion phase -->
    <div v-if="phase === 'done'" class="space-y-4">
      <div class="p-6 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 space-y-3">
        <h3 class="text-lg font-medium text-green-800 dark:text-green-200">Resource Installed</h3>
        <p class="text-sm text-green-700 dark:text-green-300">
          Your safe memory is now strengthened. You can return to this feeling
          at any time during the session if you need to feel grounded.
        </p>
      </div>

      <button
        type="button"
        class="w-full py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        data-testid="finish-button"
        @click="finish"
      >
        Continue to Session
      </button>
    </div>
  </div>
</template>
