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
    <div class="flex items-center gap-3 mb-2">
      <h1 class="text-2xl font-bold">Triage</h1>
      <span class="font-mono text-xs text-gray-600 tracking-wider">// PROTOCOL SELECTION</span>
    </div>
    <p class="text-gray-400 mb-6">
      Rate how strongly each statement applies to you so we can recommend the best protocol.
    </p>

    <p v-if="error" class="mb-4 p-3 rounded-sm bg-red-950/50 border border-red-400/20 text-red-400 text-sm font-mono">
      {{ error }}
    </p>

    <!-- Questions step -->
    <div v-if="step === 'questions'" data-testid="step-questions">
      <div
        v-for="(q, index) in questions"
        :key="q.id"
        class="mb-6 p-4 rounded-sm border border-gray-700/50 bg-surface/40"
      >
        <p class="mb-3 font-medium">
          <span class="font-mono text-cyan-400/70 mr-2">{{ String(index + 1).padStart(2, '0') }}.</span>
          {{ q.text }}
        </p>
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-500 font-mono mr-2">Not at all</span>
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
          <span class="text-xs text-gray-500 font-mono ml-2">Extremely</span>
        </div>
      </div>

      <UButton
        color="primary"
        size="lg"
        :disabled="!allAnswered"
        class="glow-cyan"
        data-testid="get-recommendation"
        @click="showRecommendation"
      >
        Analyze Responses
      </UButton>
    </div>

    <!-- Recommendation step -->
    <div v-else-if="step === 'recommendation'" data-testid="step-recommendation" class="animate-fade-in-up">
      <div class="p-6 rounded-sm bg-green-950/20 border border-green-400/20 mb-6 glow-green">
        <h2 class="text-lg font-semibold text-green-300 mb-2 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px] shadow-green-400"></span>
          Recommended Protocol
        </h2>
        <p class="text-green-200/80">
          Based on your responses, we recommend:
          <strong class="text-green-300">{{ moduleLabels[recommendation!] }}</strong>
        </p>
        <p class="text-green-400/60 text-sm mt-1 font-mono">
          {{ moduleDescriptions[recommendation!] }}
        </p>
      </div>

      <div class="mb-6">
        <h3 class="font-semibold mb-3">Select a protocol</h3>
        <p class="text-sm text-gray-500 mb-3">
          You may accept our recommendation or choose a different protocol.
        </p>
        <div class="space-y-2">
          <button
            v-for="mod in (['tetris', 'rtm', 'tnt', 'emdr'] as Module[])"
            :key="mod"
            :data-testid="`module-option-${mod}`"
            class="w-full text-left p-3 rounded-sm border transition-all"
            :class="selectedModule === mod
              ? 'border-cyan-400/30 bg-cyan-400/5 glow-cyan'
              : 'border-gray-700/50 bg-surface/30 hover:border-gray-600/50'"
            @click="selectedModule = mod"
          >
            <span class="font-medium">{{ moduleLabels[mod] }}</span>
            <span
              v-if="mod === recommendation"
              class="ml-2 text-xs font-mono text-green-400 tracking-wider"
            >
              (RECOMMENDED)
            </span>
            <p class="text-sm text-gray-500 mt-1">
              {{ moduleDescriptions[mod] }}
            </p>
          </button>
        </div>
      </div>

      <UButton
        color="primary"
        size="lg"
        class="glow-cyan"
        data-testid="start-protocol"
        @click="submit"
      >
        Initialize {{ moduleLabels[selectedModule!] }}
      </UButton>
    </div>

    <!-- Submitting -->
    <div v-else-if="step === 'submitting'" class="flex items-center justify-center py-16">
      <div class="relative w-12 h-12">
        <div class="absolute inset-0 rounded-full border border-cyan-400/30"></div>
        <div class="absolute inset-0 rounded-full border border-cyan-400 border-t-transparent animate-spin"></div>
      </div>
      <p class="text-gray-500 ml-4 font-mono text-sm">Initializing protocol...</p>
    </div>
  </div>
</template>
