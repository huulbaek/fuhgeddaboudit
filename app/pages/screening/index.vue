<script setup lang="ts">
definePageMeta({ layout: 'default' })

const config = useRuntimeConfig()
if (!config.public.screeningEnabled) {
  navigateTo('/', { replace: true })
}

const step = ref<'pcptsd5' | 'desbrief' | 'submitting'>('pcptsd5')
const error = ref('')

const pcptsd5Result = ref<{ score: number; answers: boolean[] } | null>(null)
const desbriefResult = ref<{ score: number; answers: number[] } | null>(null)

function onPcPtsd5Complete(score: number, answers: boolean[]) {
  pcptsd5Result.value = { score, answers }
  step.value = 'desbrief'
}

async function onDesBriefComplete(score: number, answers: number[]) {
  desbriefResult.value = { score, answers }
  step.value = 'submitting'
  error.value = ''

  try {
    await $fetch('/api/screening/submit', {
      method: 'POST',
      body: {
        pcptsd5: pcptsd5Result.value,
        desbrief: { score, answers },
      },
    })
    navigateTo('/screening/results')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to submit screening results'
    step.value = 'desbrief'
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold mb-2">Screening</h1>

    <div class="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span
        :class="step === 'pcptsd5' ? 'text-primary font-semibold' : 'text-green-600 dark:text-green-400'"
      >
        Step 1: PC-PTSD-5
      </span>
      <span>→</span>
      <span
        :class="{
          'text-primary font-semibold': step === 'desbrief' || step === 'submitting',
          'text-gray-400 dark:text-gray-600': step === 'pcptsd5',
        }"
      >
        Step 2: DES-Brief
      </span>
    </div>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <ScreeningPcPtsd5
      v-if="step === 'pcptsd5'"
      @complete="onPcPtsd5Complete"
    />

    <ScreeningDesBrief
      v-if="step === 'desbrief'"
      @complete="onDesBriefComplete"
    />

    <div v-if="step === 'submitting'" class="text-center py-12">
      <p class="text-lg text-gray-500 dark:text-gray-400">Submitting your results...</p>
    </div>
  </div>
</template>
