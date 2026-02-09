<script setup lang="ts">
definePageMeta({ layout: 'session' })

type Phase = 'cue-selection' | 'association-training' | 'navigating'

interface Cue {
  id: string
  src: string
  name: string
  source: 'upload' | 'library'
}

interface TrainedCue extends Cue {
  triggersMemory: boolean | null
}

const phase = ref<Phase>('cue-selection')
const error = ref('')

// Library images — simple geometric/neutral shapes the user can pick from
const libraryImages: { src: string; name: string }[] = [
  { src: '/images/cues/geometric-circle.svg', name: 'Circle' },
  { src: '/images/cues/geometric-square.svg', name: 'Square' },
  { src: '/images/cues/geometric-triangle.svg', name: 'Triangle' },
  { src: '/images/cues/geometric-diamond.svg', name: 'Diamond' },
  { src: '/images/cues/geometric-star.svg', name: 'Star' },
  { src: '/images/cues/geometric-hexagon.svg', name: 'Hexagon' },
  { src: '/images/cues/geometric-cross.svg', name: 'Cross' },
  { src: '/images/cues/geometric-oval.svg', name: 'Oval' },
  { src: '/images/cues/geometric-arrow.svg', name: 'Arrow' },
  { src: '/images/cues/geometric-wave.svg', name: 'Wave' },
  { src: '/images/cues/geometric-spiral.svg', name: 'Spiral' },
  { src: '/images/cues/geometric-zigzag.svg', name: 'Zigzag' },
]

const MIN_CUES = 6

// Cue selection state
const cues = ref<Cue[]>([])

// Association training state
const trainedCues = ref<TrainedCue[]>([])
const currentTrainingIndex = ref(0)

const phaseNumber = computed(() => {
  switch (phase.value) {
    case 'cue-selection': return 1
    case 'association-training': return 2
    case 'navigating': return 2
  }
})

const phaseLabel = computed(() => {
  switch (phase.value) {
    case 'cue-selection': return 'Cue Selection'
    case 'association-training': return 'Association Training'
    case 'navigating': return 'Association Training'
  }
})

const hasEnoughCues = computed(() => cues.value.length >= MIN_CUES)

function toggleLibraryImage(img: { src: string; name: string }) {
  const idx = cues.value.findIndex(c => c.src === img.src)
  if (idx >= 0) {
    cues.value.splice(idx, 1)
  } else {
    cues.value.push({
      id: `lib-${img.name.toLowerCase()}`,
      src: img.src,
      name: img.name,
      source: 'library',
    })
  }
}

function isLibraryImageSelected(src: string) {
  return cues.value.some(c => c.src === src)
}

function onFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  for (const file of Array.from(input.files)) {
    if (!file.type.startsWith('image/')) continue
    const url = URL.createObjectURL(file)
    cues.value.push({
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      src: url,
      name: file.name,
      source: 'upload',
    })
  }

  // Reset file input
  input.value = ''
}

function removeCue(id: string) {
  const idx = cues.value.findIndex(c => c.id === id)
  if (idx >= 0) {
    const cue = cues.value[idx]
    if (cue.source === 'upload') {
      URL.revokeObjectURL(cue.src)
    }
    cues.value.splice(idx, 1)
  }
}

function proceedToTraining() {
  // Initialize training state
  trainedCues.value = cues.value.map(c => ({ ...c, triggersMemory: null }))
  currentTrainingIndex.value = 0
  phase.value = 'association-training'
}

const currentTrainingCue = computed(() => {
  if (currentTrainingIndex.value < trainedCues.value.length) {
    return trainedCues.value[currentTrainingIndex.value]
  }
  return null
})

const trainingComplete = computed(() => {
  return trainedCues.value.length > 0 && trainedCues.value.every(c => c.triggersMemory !== null)
})

const confirmedCues = computed(() => {
  return trainedCues.value.filter(c => c.triggersMemory === true)
})

const trainingPassed = computed(() => {
  return confirmedCues.value.length >= MIN_CUES
})

function answerTraining(triggersMemory: boolean) {
  if (currentTrainingCue.value) {
    currentTrainingCue.value.triggersMemory = triggersMemory
    if (currentTrainingIndex.value < trainedCues.value.length - 1) {
      currentTrainingIndex.value++
    }
  }
}

async function startSession() {
  phase.value = 'navigating'
  error.value = ''

  try {
    // Store cue data client-side only (privacy-first)
    const cueData = confirmedCues.value.map(c => ({
      id: c.id,
      src: c.src,
      name: c.name,
      source: c.source,
    }))
    try {
      localStorage.setItem('tnt-cues', JSON.stringify(cueData))
    } catch {
      // localStorage may be unavailable
    }

    const session = await useSessionService().create({ module: 'tnt' })
    navigateTo(`/modules/tnt/session?sessionId=${(session as any).id}`)
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to create session'
    phase.value = 'association-training'
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-2 sm:px-4 py-5 sm:py-8">
    <div class="mb-4">
      <UButton to="/" variant="link" color="neutral" size="sm" data-testid="back-to-dashboard">
        &larr; Change Module
      </UButton>
    </div>
    <h1 class="text-2xl font-bold mb-2">TNT Suppression Training</h1>

    <div class="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
      <span
        :class="{
          'text-primary font-semibold': phase === 'cue-selection',
          'text-green-600 dark:text-green-400': phaseNumber > 1,
        }"
      >
        1. Cue Selection
      </span>
      <span class="hidden sm:inline">→</span>
      <span
        :class="{
          'text-primary font-semibold': phase === 'association-training' || phase === 'navigating',
          'text-gray-400 dark:text-gray-600': phaseNumber < 2,
        }"
      >
        2. Association Training
      </span>
    </div>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Phase 1: Cue Selection -->
    <div v-if="phase === 'cue-selection'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="1" :total="2" />

      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Select Proxy Cues</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Choose at least {{ MIN_CUES }} neutral images that remind you of the target memory.
          These are "proxy cues" — everyday images you associate with the memory, not the memory
          itself. You can select from the library below or upload your own.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Your cue images stay on your device and are never sent to our servers.
        </p>
      </div>

      <!-- Library grid -->
      <div>
        <h3 class="text-sm font-medium mb-2">Image Library</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            v-for="img in libraryImages"
            :key="img.src"
            type="button"
            class="aspect-square rounded-lg border-2 p-2 flex flex-col items-center justify-center gap-1 transition-colors"
            :class="
              isLibraryImageSelected(img.src)
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            "
            @click="toggleLibraryImage(img)"
          >
            <span class="text-2xl">{{ img.name.charAt(0) }}</span>
            <span class="text-xs text-gray-600 dark:text-gray-400">{{ img.name }}</span>
          </button>
        </div>
      </div>

      <!-- Upload -->
      <div>
        <h3 class="text-sm font-medium mb-2">Upload Your Own</h3>
        <label
          class="block w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
        >
          <span class="text-sm text-gray-600 dark:text-gray-400">Click to upload images</span>
          <input
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="onFileUpload"
          />
        </label>
      </div>

      <!-- Selected cues list -->
      <div v-if="cues.length > 0">
        <h3 class="text-sm font-medium mb-2">
          Selected Cues ({{ cues.length }}/{{ MIN_CUES }} minimum)
        </h3>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="cue in cues"
            :key="cue.id"
            class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-800"
          >
            {{ cue.name }}
            <button
              type="button"
              class="ml-1 text-gray-400 hover:text-red-500"
              @click="removeCue(cue.id)"
            >
              &times;
            </button>
          </span>
        </div>
      </div>

      <button
        type="button"
        :disabled="!hasEnoughCues"
        class="w-full py-3 px-4 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        :class="
          hasEnoughCues
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
        "
        @click="proceedToTraining"
      >
        Continue
      </button>
    </div>

    <!-- Phase 2: Association Training -->
    <div v-if="phase === 'association-training'" class="space-y-6">
      <SharedPhaseIndicator :label="phaseLabel" :current="2" :total="2" />

      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Association Training</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          For each cue, look at the image and check whether it triggers the target memory.
          We need at least {{ MIN_CUES }} cues that reliably trigger the memory.
        </p>
      </div>

      <!-- Current cue being tested -->
      <div v-if="currentTrainingCue && !trainingComplete" class="space-y-4">
        <div class="text-center text-sm text-gray-500 dark:text-gray-400">
          Cue {{ currentTrainingIndex + 1 }} of {{ trainedCues.length }}
        </div>

        <div class="flex justify-center">
          <div class="w-32 h-32 sm:w-40 sm:h-40 rounded-xl border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center bg-white dark:bg-gray-800">
            <span class="text-4xl sm:text-5xl">{{ currentTrainingCue.name.charAt(0) }}</span>
          </div>
        </div>

        <p class="text-center text-sm font-medium text-gray-700 dark:text-gray-300">
          "{{ currentTrainingCue.name }}"
        </p>

        <p class="text-center text-sm text-gray-600 dark:text-gray-400">
          Does this cue trigger the target memory?
        </p>

        <div class="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            class="w-full sm:flex-1 py-3 px-4 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-600 text-white hover:bg-green-700"
            @click="answerTraining(true)"
          >
            Yes
          </button>
          <button
            type="button"
            class="w-full sm:flex-1 py-3 px-4 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-600 text-white hover:bg-red-700"
            @click="answerTraining(false)"
          >
            No
          </button>
        </div>
      </div>

      <!-- Training results -->
      <div v-if="trainingComplete" class="space-y-4">
        <div class="p-4 rounded-lg" :class="trainingPassed ? 'bg-green-50 dark:bg-green-950' : 'bg-amber-50 dark:bg-amber-950'">
          <p class="text-sm font-medium" :class="trainingPassed ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'">
            {{ confirmedCues.length }} of {{ trainedCues.length }} cues trigger the memory.
            <span v-if="trainingPassed">Ready to begin the session.</span>
            <span v-else>You need at least {{ MIN_CUES }} confirmed cues. Please go back and add more cues.</span>
          </p>
        </div>

        <button
          v-if="!trainingPassed"
          type="button"
          class="w-full py-3 px-4 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          @click="phase = 'cue-selection'"
        >
          Back to Cue Selection
        </button>

        <button
          v-if="trainingPassed"
          type="button"
          class="w-full py-3 px-4 rounded-lg font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
          @click="startSession"
        >
          Begin Session
        </button>
      </div>
    </div>

    <!-- Navigating state -->
    <div v-if="phase === 'navigating'" class="text-center py-12">
      <p class="text-lg text-gray-500 dark:text-gray-400">Starting TNT session...</p>
    </div>
  </div>
</template>
