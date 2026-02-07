<script setup lang="ts">
const emit = defineEmits<{
  complete: [description: string]
}>()

const STORAGE_KEY = 'mnemosyne-safe-place'

const steps = [
  {
    title: 'Close your eyes and breathe',
    instruction:
      'Take a few slow, deep breaths. Let your body settle. When you feel ready, open your eyes and continue.',
  },
  {
    title: 'Imagine a safe place',
    instruction:
      'Think of a real or imaginary place where you feel completely safe, calm, and at peace. It could be a beach, a cozy room, a forest trail, or anywhere that brings you comfort.',
  },
  {
    title: 'Engage your senses',
    instruction:
      'Picture it vividly. What do you see? What sounds do you hear? What can you smell or feel? Let yourself be fully present in this place.',
  },
  {
    title: 'Anchor the feeling',
    instruction:
      'Notice the feeling of safety and calm in your body. Let it grow. This is your safe place — you can return here anytime you need to.',
  },
]

const currentStep = ref(0)
const description = ref('')
const showDescriptionInput = ref(false)

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    description.value = saved
  }
})

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  } else {
    showDescriptionInput.value = true
  }
}

function saveAndComplete() {
  const trimmed = description.value.trim()
  if (!trimmed) return
  localStorage.setItem(STORAGE_KEY, trimmed)
  emit('complete', trimmed)
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-xl font-semibold">Build Your Safe Place</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Before starting any protocol, we'll help you create a mental safe place
      you can return to at any time during a session.
    </p>

    <!-- Guided steps -->
    <div v-if="!showDescriptionInput" class="space-y-4">
      <div class="p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
        <p class="text-sm text-gray-400 dark:text-gray-500">
          Step {{ currentStep + 1 }} of {{ steps.length }}
        </p>
        <h3 class="text-lg font-medium">{{ steps[currentStep].title }}</h3>
        <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
          {{ steps[currentStep].instruction }}
        </p>
      </div>

      <UButton
        color="primary"
        size="lg"
        block
        @click="nextStep"
      >
        {{ currentStep < steps.length - 1 ? 'Continue' : 'Describe Your Safe Place' }}
      </UButton>
    </div>

    <!-- Description input -->
    <div v-else class="space-y-4">
      <div class="p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
        <h3 class="text-lg font-medium">Describe your safe place</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Write a brief description of the safe place you just imagined. This
          stays on your device only and is never sent to our servers.
        </p>
        <UTextarea
          v-model="description"
          placeholder="e.g., A quiet cabin by a lake surrounded by tall pine trees..."
          :rows="4"
          autofocus
        />
      </div>

      <UButton
        :disabled="!description.trim()"
        color="primary"
        size="lg"
        block
        @click="saveAndComplete"
      >
        Save & Continue
      </UButton>
    </div>
  </div>
</template>
