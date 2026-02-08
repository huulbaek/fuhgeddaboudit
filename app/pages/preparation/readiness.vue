<script setup lang="ts">
definePageMeta({ layout: 'default' })

const submitting = ref(false)
const error = ref('')

async function onReadinessSuccess() {
  submitting.value = true
  error.value = ''

  try {
    await $fetch('/api/preparation/complete', { method: 'POST' })
    navigateTo('/triage')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save preparation status'
    submitting.value = false
  }
}

function onReadinessRetry() {
  // No-op: the ReadinessTimer component handles retry state internally
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-2 sm:py-4">
    <h1 class="text-2xl font-bold mb-2">Preparation</h1>

    <div class="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
      <span class="text-green-600 dark:text-green-400">Step 1: Safe Place</span>
      <span class="hidden sm:inline">→</span>
      <span class="text-primary font-semibold">Step 2: Readiness Check</span>
    </div>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <div v-if="submitting" class="text-center py-10 sm:py-12">
      <p class="text-base sm:text-lg text-gray-500 dark:text-gray-400">Saving your progress...</p>
    </div>

    <PreparationReadinessTimer
      v-else
      @success="onReadinessSuccess"
      @retry="onReadinessRetry"
    />
  </div>
</template>
