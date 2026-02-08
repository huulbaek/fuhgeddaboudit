<script setup lang="ts">
const emit = defineEmits<{
  complete: [score: number, answers: number[]]
}>()

const questions = [
  'Some people have the experience of driving or riding in a car or bus or subway and suddenly realizing that they don\'t remember what has happened during all or part of the trip.',
  'Some people find that sometimes they are listening to someone talk and they suddenly realize that they did not hear part or all of what was said.',
  'Some people have the experience of finding themselves in a place and having no idea how they got there.',
  'Some people have the experience of finding themselves dressed in clothes that they don\'t remember putting on.',
  'Some people sometimes find that they are approached by people that they don\'t know who call them by another name or insist that they have met them before.',
  'Some people sometimes have the experience of feeling that other people, objects, and the world around them are not real.',
  'Some people sometimes have the experience of feeling that their body does not seem to belong to them.',
  'Some people find that in one situation they may act so differently compared with another situation that they feel almost as if they were two different people.',
]

const options = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const answers = ref<(number | null)[]>(Array(8).fill(null))

const allAnswered = computed(() => answers.value.every((a) => a !== null))

const score = computed(() => {
  const answered = answers.value.filter((a): a is number => a !== null)
  if (answered.length === 0) return 0
  return Math.round(answered.reduce((sum, a) => sum + a, 0) / answered.length)
})

function setAnswer(index: number, value: number) {
  answers.value[index] = value
}

function submit() {
  if (!allAnswered.value) return
  emit('complete', score.value, answers.value as number[])
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold">DES-Brief Dissociation Screening</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      For each question, select the percentage of time this experience happens
      to you (0% = never, 100% = always).
    </p>

    <div
      v-for="(question, index) in questions"
      :key="index"
      class="p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
    >
      <p class="text-sm sm:text-base font-medium">{{ index + 1 }}. {{ question }}</p>
      <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-2">
        <UButton
          v-for="option in options"
          :key="option"
          class="w-full justify-center"
          :color="answers[index] === option ? 'primary' : 'neutral'"
          :variant="answers[index] === option ? 'solid' : 'outline'"
          size="sm"
          @click="setAnswer(index, option)"
        >
          {{ option }}%
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
