<script setup lang="ts">
const emit = defineEmits<{
  complete: [score: number, answers: boolean[]]
}>()

const questions = [
  'In the past month, have you had nightmares about a stressful experience or thought about it when you did not want to?',
  'In the past month, have you tried hard not to think about a stressful experience or went out of your way to avoid situations that reminded you of it?',
  'In the past month, have you been constantly on guard, watchful, or easily startled?',
  'In the past month, have you felt numb or detached from people, activities, or your surroundings?',
  'In the past month, have you felt guilty or unable to stop blaming yourself or others for a stressful experience or what happened after it?',
]

const answers = ref<(boolean | null)[]>(Array(5).fill(null))

const allAnswered = computed(() => answers.value.every((a) => a !== null))

const score = computed(() =>
  answers.value.reduce((sum, a) => sum + (a === true ? 1 : 0), 0),
)

function setAnswer(index: number, value: boolean) {
  answers.value[index] = value
}

function submit() {
  if (!allAnswered.value) return
  emit('complete', score.value, answers.value as boolean[])
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold">PC-PTSD-5 Screening</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Sometimes things happen to people that are unusually or especially
      frightening, horrible, or traumatic. Please answer the following
      questions about your experiences in the past month.
    </p>

    <div
      v-for="(question, index) in questions"
      :key="index"
      class="p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
    >
      <p class="text-sm sm:text-base font-medium">{{ index + 1 }}. {{ question }}</p>
      <div class="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
        <UButton
          class="w-full sm:w-auto"
          :color="answers[index] === true ? 'primary' : 'neutral'"
          :variant="answers[index] === true ? 'solid' : 'outline'"
          size="sm"
          @click="setAnswer(index, true)"
        >
          Yes
        </UButton>
        <UButton
          class="w-full sm:w-auto"
          :color="answers[index] === false ? 'primary' : 'neutral'"
          :variant="answers[index] === false ? 'solid' : 'outline'"
          size="sm"
          @click="setAnswer(index, false)"
        >
          No
        </UButton>
      </div>
    </div>

    <UButton
      :disabled="!allAnswered"
      color="primary"
      size="lg"
      block
      @click="submit"
    >
      Submit Screening
    </UButton>
  </div>
</template>
