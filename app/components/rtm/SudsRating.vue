<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    sessionId: string
    setNumber: number
    previousRating?: number | null
  }>(),
  {
    previousRating: null,
  },
)

const emit = defineEmits<{
  success: [rating: number]
  repeat: [rating: number]
  abort: [reason: string]
}>()

const { trigger: triggerGrounding } = useGrounding()

const selectedRating = ref<number | null>(null)
const submitted = ref(false)
const unchangedSets = ref(0)
const lastSubmittedRating = ref<number | null>(props.previousRating ?? null)

const outcome = computed<'success' | 'repeat' | 'abort' | null>(() => {
  if (!submitted.value || selectedRating.value === null) return null
  const rating = selectedRating.value

  if (rating <= 3) return 'success'

  // Check if unchanged after 3 full sets
  if (
    lastSubmittedRating.value !== null &&
    rating === lastSubmittedRating.value
  ) {
    if (unchangedSets.value + 1 >= 3) return 'abort'
  }

  return 'repeat'
})

function onSudsSelect(rating: number) {
  selectedRating.value = rating
}

function submit() {
  if (selectedRating.value === null) return
  submitted.value = true

  const rating = selectedRating.value

  // Track unchanged ratings
  if (lastSubmittedRating.value !== null && rating === lastSubmittedRating.value) {
    unchangedSets.value++
  } else {
    unchangedSets.value = 0
  }

  lastSubmittedRating.value = rating
}

function confirmSuccess() {
  if (selectedRating.value !== null) {
    emit('success', selectedRating.value)
  }
}

function continueAnother() {
  if (selectedRating.value !== null) {
    emit('repeat', selectedRating.value)
  }
}

function confirmRepeat() {
  if (selectedRating.value !== null) {
    emit('repeat', selectedRating.value)
  }
}

function confirmAbort() {
  triggerGrounding('RTM abort: SUDs unchanged after 3 sets')
  emit('abort', 'SUDs unchanged after 3 full sets')
}
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-lg font-semibold text-center">
      Post-Loop Check — Set {{ setNumber }}
    </h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
      How distressed do you feel about the memory now?
    </p>

    <SharedSudsScale
      :model-value="selectedRating"
      :disabled="submitted"
      @select="onSudsSelect"
    />

    <!-- Submit button (before outcome is determined) -->
    <div v-if="!submitted" class="flex justify-center">
      <button
        :disabled="selectedRating === null"
        class="px-6 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        :class="
          selectedRating !== null
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        "
        @click="submit"
      >
        Submit Rating
      </button>
    </div>

    <!-- Success outcome: SUDs ≤ 3 -->
    <div
      v-if="outcome === 'success'"
      data-testid="outcome-success"
      class="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 text-center space-y-3"
    >
      <p class="text-green-700 dark:text-green-300 font-semibold">
        Your distress level has decreased significantly.
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        You can end this session or do another set of loops.
      </p>
      <div class="flex justify-center gap-3">
        <button
          class="px-4 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          @click="confirmSuccess"
        >
          End Session
        </button>
        <button
          class="px-4 py-2 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
          @click="continueAnother"
        >
          Another Set
        </button>
      </div>
    </div>

    <!-- Repeat outcome: SUDs > 3 -->
    <div
      v-if="outcome === 'repeat'"
      data-testid="outcome-repeat"
      class="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-center space-y-3"
    >
      <p class="text-amber-700 dark:text-amber-300 font-semibold">
        Your distress level is still elevated.
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        We'll run another set of loops to continue processing.
      </p>
      <div class="flex justify-center">
        <button
          class="px-4 py-2 rounded-lg font-semibold bg-amber-600 text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          @click="confirmRepeat"
        >
          Continue
        </button>
      </div>
    </div>

    <!-- Abort outcome: unchanged after 3 sets -->
    <div
      v-if="outcome === 'abort'"
      data-testid="outcome-abort"
      class="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-center space-y-3"
    >
      <p class="text-red-700 dark:text-red-300 font-semibold">
        Your distress level has not changed after 3 sets.
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        For your safety, we'll end this session and start a grounding exercise.
      </p>
      <div class="flex justify-center">
        <button
          class="px-4 py-2 rounded-lg font-semibold bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          @click="confirmAbort"
        >
          OK
        </button>
      </div>
    </div>
  </div>
</template>
