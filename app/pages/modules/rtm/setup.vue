<script setup lang="ts">
definePageMeta({ layout: 'session' })

type Phase = 'suds-baseline' | 'image-labeling' | 'dissociation-check' | 'navigating'

const phase = ref<Phase>('suds-baseline')
const error = ref('')

// SUDs baseline
const baselineRating = ref<number | null>(null)

// Image labels (stored client-side only, never sent to server)
const startLabel = ref('')
const endLabel = ref('')

// Dissociation check
const boothConfirmed = ref(false)

const phaseNumber = computed(() => {
  switch (phase.value) {
    case 'suds-baseline': return 1
    case 'image-labeling': return 2
    case 'dissociation-check': return 3
    case 'navigating': return 3
  }
})

const phaseLabel = computed(() => {
  switch (phase.value) {
    case 'suds-baseline': return 'SUDs Baseline'
    case 'image-labeling': return 'Image Labeling'
    case 'dissociation-check': return 'Projection Booth'
    case 'navigating': return 'Projection Booth'
  }
})

function onSudsSelect(rating: number) {
  baselineRating.value = rating
}

function proceedToLabeling() {
  phase.value = 'image-labeling'
}

function proceedToDissociationCheck() {
  phase.value = 'dissociation-check'
}

const labelsValid = computed(() => {
  return startLabel.value.trim().length > 0 && endLabel.value.trim().length > 0
})

async function startSession() {
  boothConfirmed.value = true
  phase.value = 'navigating'
  error.value = ''

  try {
    // Persist image labels client-side for the session page
    try {
      localStorage.setItem('rtm-start-label', startLabel.value)
      localStorage.setItem('rtm-end-label', endLabel.value)
    } catch {
      // localStorage may be unavailable
    }

    const session = await $fetch('/api/sessions', {
      method: 'POST',
      body: {
        module: 'rtm',
        suds: { rating: baselineRating.value, phase: 'baseline' },
      },
    })
    navigateTo(`/modules/rtm/session?sessionId=${session.id}`)
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to create session'
    phase.value = 'dissociation-check'
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-2">RTM Rewind Protocol</h1>

    <div class="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <span
        :class="{
          'text-primary font-semibold': phase === 'suds-baseline',
          'text-green-600 dark:text-green-400': phaseNumber > 1,
        }"
      >
        1. Baseline
      </span>
      <span>→</span>
      <span
        :class="{
          'text-primary font-semibold': phase === 'image-labeling',
          'text-green-600 dark:text-green-400': phaseNumber > 2,
          'text-gray-400 dark:text-gray-600': phaseNumber < 2,
        }"
      >
        2. Images
      </span>
      <span>→</span>
      <span
        :class="{
          'text-primary font-semibold': phase === 'dissociation-check' || phase === 'navigating',
          'text-gray-400 dark:text-gray-600': phaseNumber < 3,
        }"
      >
        3. Booth
      </span>
    </div>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Phase 1: SUDs Baseline -->
    <div v-if="phase === 'suds-baseline'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="1" :total="3" />

      <div class="p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Baseline Distress Rating</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Before we begin, rate your current level of distress when you think about the memory.
          This gives us a starting point to measure progress.
        </p>
      </div>

      <SharedSudsScale :model-value="baselineRating" @select="onSudsSelect" />

      <button
        type="button"
        :disabled="baselineRating === null"
        class="w-full py-3 px-4 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        :class="
          baselineRating !== null
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
        "
        @click="proceedToLabeling"
      >
        Continue
      </button>
    </div>

    <!-- Phase 2: Image Labeling -->
    <div v-if="phase === 'image-labeling'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="2" :total="3" />

      <div class="p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Start &amp; End Images</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Think of two safe moments: one from <strong>before</strong> the event and one from
          <strong>after</strong>. Give each a short label. These labels stay on your device and are
          never sent to our servers.
        </p>
      </div>

      <div class="space-y-4">
        <div>
          <label for="start-label" class="block text-sm font-medium mb-1">
            Start Image (A) — safe moment before
          </label>
          <input
            id="start-label"
            v-model="startLabel"
            type="text"
            placeholder="e.g. 'Morning coffee'"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="end-label" class="block text-sm font-medium mb-1">
            End Image (B) — safe moment after
          </label>
          <input
            id="end-label"
            v-model="endLabel"
            type="text"
            placeholder="e.g. 'Walking the dog'"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <button
        type="button"
        :disabled="!labelsValid"
        class="w-full py-3 px-4 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        :class="
          labelsValid
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
        "
        @click="proceedToDissociationCheck"
      >
        Continue
      </button>
    </div>

    <!-- Phase 3: Dissociation Check -->
    <div v-if="phase === 'dissociation-check'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="3" :total="3" />

      <div class="p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Enter the Projection Booth</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Imagine you are sitting in a movie theater. Now float up out of your seat and into the
          projection booth behind you. You can see the screen through a small window, but you are
          safely separated from it.
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          From this booth, you will watch the memory play on the screen — like an old movie, in
          grayscale. You are the projectionist, not the actor.
        </p>
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
          When you can clearly picture yourself in the projection booth, press the button below.
        </p>
      </div>

      <button
        type="button"
        class="w-full py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        @click="startSession"
      >
        I am in the projection booth
      </button>
    </div>

    <!-- Navigating state -->
    <div v-if="phase === 'navigating'" class="text-center py-12">
      <p class="text-lg text-gray-500 dark:text-gray-400">Starting RTM session...</p>
    </div>
  </div>
</template>
