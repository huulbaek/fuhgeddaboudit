<script setup lang="ts">
definePageMeta({ layout: 'default' })

const loading = ref(true)
const error = ref('')

type ScreeningResult = {
  instrument: string
  score: number
  result: string
  completedAt: string
}

const results = ref<ScreeningResult[]>([])
const overallResult = ref<'excluded' | 'admitted' | 'informational' | ''>('')

onMounted(async () => {
  try {
    const data = await $fetch<{ screeningComplete: boolean; results: ScreeningResult[] }>('/api/screening/status')
    if (!data.screeningComplete || data.results.length === 0) {
      navigateTo('/screening')
      return
    }
    results.value = data.results

    const desbrief = data.results.find(r => r.instrument === 'DES-Brief')
    const pcptsd5 = data.results.find(r => r.instrument === 'PC-PTSD-5')

    if (desbrief?.result === 'excluded') {
      overallResult.value = 'excluded'
    } else if (pcptsd5?.result === 'admitted') {
      overallResult.value = 'admitted'
    } else {
      overallResult.value = 'informational'
    }
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to load screening results'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">Screening Results</h1>

    <div v-if="loading" class="text-center py-12">
      <p class="text-lg text-gray-500 dark:text-gray-400">Loading your results...</p>
    </div>

    <p v-else-if="error" class="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <template v-else>
      <!-- Excluded: DES-Brief high dissociation -->
      <div v-if="overallResult === 'excluded'" data-testid="outcome-excluded">
        <div class="p-6 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 mb-6">
          <h2 class="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3">
            This program may not be right for you at this time
          </h2>
          <p class="text-amber-700 dark:text-amber-300 mb-4">
            Based on your screening results, we recommend working with a mental health professional
            before using self-guided memory protocols. Dissociative experiences at higher levels
            require professional support to ensure your safety.
          </p>
        </div>

        <div class="p-6 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <h3 class="text-lg font-semibold mb-3">Crisis Resources</h3>
          <ul class="space-y-3">
            <li>
              <strong>988 Suicide &amp; Crisis Lifeline</strong><br />
              Call or text <strong>988</strong> — available 24/7
            </li>
            <li>
              <strong>Crisis Text Line</strong><br />
              Text <strong>HELLO</strong> to <strong>741741</strong> — free, 24/7 support
            </li>
          </ul>
        </div>
      </div>

      <!-- Admitted: PC-PTSD-5 >= 3 -->
      <div v-else-if="overallResult === 'admitted'" data-testid="outcome-admitted">
        <div class="p-6 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 mb-6">
          <h2 class="text-lg font-semibold text-green-800 dark:text-green-200 mb-3">
            You're ready to proceed
          </h2>
          <p class="text-green-700 dark:text-green-300 mb-4">
            Your screening is complete. The next step is a brief preparation module to help
            you build the skills needed for the memory protocols.
          </p>
          <UButton to="/preparation" color="primary" size="lg">
            Continue to Preparation
          </UButton>
        </div>
      </div>

      <!-- Informational: below threshold -->
      <div v-else-if="overallResult === 'informational'" data-testid="outcome-informational">
        <div class="p-6 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mb-6">
          <h2 class="text-lg font-semibold mb-3">
            Your scores are below the clinical threshold
          </h2>
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            Your responses suggest that your symptoms may not meet the level typically associated
            with trauma-related conditions. This program is designed for individuals experiencing
            significant trauma-related symptoms.
          </p>
          <p class="text-gray-600 dark:text-gray-400">
            If you're still experiencing distress, we recommend speaking with a mental health
            professional who can provide a thorough assessment and personalized guidance.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
