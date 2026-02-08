<script setup lang="ts">
definePageMeta({ layout: 'default' })

type Module = 'tetris' | 'rtm' | 'tnt' | 'emdr'

interface Question {
  id: string
  text: string
  module: Module
}

const questions: Question[] = [
  {
    id: 'intrusive-images',
    text: 'I experience intrusive visual images or "flashbacks" of the event that replay in my mind.',
    module: 'tetris',
  },
  {
    id: 'fear-pain',
    text: 'I experience intense fear, pain, or emotional overwhelm when reminded of the event.',
    module: 'rtm',
  },
  {
    id: 'cant-stop-thinking',
    text: 'I can\'t stop thinking about the event even when I try to suppress those thoughts.',
    module: 'tnt',
  },
  {
    id: 'general-distress',
    text: 'I feel a general sense of distress, unease, or emotional tension related to the event.',
    module: 'emdr',
  },
]

const ratings = ref<Record<string, number>>({})
const step = ref<'questions' | 'recommendation' | 'submitting'>('questions')
const error = ref('')
const recommendation = ref<Module | null>(null)
const selectedModule = ref<Module | null>(null)

const moduleLabels: Record<Module, string> = {
  tetris: 'Visuospatial Interference (Tetris)',
  rtm: 'Reconsolidation of Traumatic Memories (RTM)',
  tnt: 'Think/No-Think Suppression (TNT)',
  emdr: 'Eye Movement Desensitization (EMDR)',
}

const moduleDescriptions: Record<Module, string> = {
  tetris: 'Uses a spatial reasoning game to interfere with intrusive visual memories during their reconsolidation window.',
  rtm: 'Guides you through re-viewing the memory from a safe distance, then rapidly rewinding it to reduce emotional charge.',
  tnt: 'Trains your ability to suppress unwanted memories through repeated practice with cue-based recall and inhibition.',
  emdr: 'Uses bilateral stimulation (visual and audio) to help reprocess distressing memories and reduce their emotional impact.',
}

const allAnswered = computed(() => questions.every(q => ratings.value[q.id] !== undefined))

function computeRecommendation(): Module {
  let topModule: Module = 'emdr'
  let topScore = -1

  for (const q of questions) {
    const score = ratings.value[q.id] ?? 0
    if (score > topScore) {
      topScore = score
      topModule = q.module
    }
  }

  return topModule
}

function showRecommendation() {
  recommendation.value = computeRecommendation()
  selectedModule.value = recommendation.value
  step.value = 'recommendation'
}

async function submit() {
  if (!selectedModule.value) return
  step.value = 'submitting'
  error.value = ''

  try {
    await $fetch('/api/triage/recommend', {
      method: 'POST',
      body: {
        answers: questions.map(q => ({
          id: q.id,
          rating: ratings.value[q.id] ?? 0,
        })),
        recommendation: recommendation.value,
        selectedModule: selectedModule.value,
      },
    })
    navigateTo(`/modules/${selectedModule.value}/setup`)
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save triage result'
    step.value = 'recommendation'
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold mb-2">Triage</h1>
    <p class="text-gray-600 dark:text-gray-400 mb-6">
      Rate how strongly each statement applies to you so we can recommend the best protocol.
    </p>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Questions step -->
    <div v-if="step === 'questions'" data-testid="step-questions">
      <div
        v-for="(q, index) in questions"
        :key="q.id"
        class="mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <p class="mb-3 font-medium">{{ index + 1 }}. {{ q.text }}</p>
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-500 mr-2">Not at all</span>
          <UButton
            v-for="n in 5"
            :key="n"
            :color="ratings[q.id] === n ? 'primary' : 'neutral'"
            :variant="ratings[q.id] === n ? 'solid' : 'outline'"
            size="sm"
            @click="ratings[q.id] = n"
          >
            {{ n }}
          </UButton>
          <span class="text-xs text-gray-500 ml-2">Extremely</span>
        </div>
      </div>

      <UButton
        color="primary"
        size="lg"
        :disabled="!allAnswered"
        data-testid="get-recommendation"
        @click="showRecommendation"
      >
        Get Recommendation
      </UButton>
    </div>

    <!-- Recommendation step -->
    <div v-else-if="step === 'recommendation'" data-testid="step-recommendation">
      <div class="p-6 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 mb-6">
        <h2 class="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
          Recommended Protocol
        </h2>
        <p class="text-green-700 dark:text-green-300">
          Based on your responses, we recommend:
          <strong>{{ moduleLabels[recommendation!] }}</strong>
        </p>
        <p class="text-green-600 dark:text-green-400 text-sm mt-1">
          {{ moduleDescriptions[recommendation!] }}
        </p>
      </div>

      <div class="mb-6">
        <h3 class="font-semibold mb-3">Select a protocol</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          You may accept our recommendation or choose a different protocol.
        </p>
        <div class="space-y-2">
          <button
            v-for="mod in (['tetris', 'rtm', 'tnt', 'emdr'] as Module[])"
            :key="mod"
            :data-testid="`module-option-${mod}`"
            class="w-full text-left p-3 rounded-lg border transition-colors"
            :class="selectedModule === mod
              ? 'border-primary bg-primary/5 dark:bg-primary/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
            @click="selectedModule = mod"
          >
            <span class="font-medium">{{ moduleLabels[mod] }}</span>
            <span
              v-if="mod === recommendation"
              class="ml-2 text-xs text-green-600 dark:text-green-400"
            >
              (Recommended)
            </span>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ moduleDescriptions[mod] }}
            </p>
          </button>
        </div>
      </div>

      <UButton
        color="primary"
        size="lg"
        data-testid="start-protocol"
        @click="submit"
      >
        Start {{ moduleLabels[selectedModule!] }}
      </UButton>
    </div>

    <!-- Submitting -->
    <div v-else-if="step === 'submitting'" class="text-center py-12">
      <p class="text-lg text-gray-500 dark:text-gray-400">Saving your selection...</p>
    </div>
  </div>
</template>
