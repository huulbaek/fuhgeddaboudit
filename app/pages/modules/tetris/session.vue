<script setup lang="ts">
definePageMeta({ layout: 'session' })

const SESSION_DURATION_MS = 20 * 60 * 1000

const route = useRoute()
const sessionId = computed(() => route.query.sessionId as string)

const phase = ref<'playing' | 'rating' | 'complete'>('playing')
const error = ref('')
const saving = ref(false)

const gameBoard = ref<{ startGame: () => void; stopGame: () => void; gameState: Ref<{ score: number; linesCleared: number; gameOver: boolean }> } | null>(null)
const sessionTimer = ref<{ start: () => void; stop: () => void } | null>(null)

const difficulty = useAdaptiveDifficulty()
const suds = useSuds(sessionId.value)

// Track piece spawn time for adaptive difficulty recording
let pieceSpawnTime = 0
let pieceWasRotated = false

const finalStats = ref<{ score: number; linesCleared: number; durationMs: number }>({
  score: 0,
  linesCleared: 0,
  durationMs: SESSION_DURATION_MS,
})

function onLinesCleared(count: number) {
  // Record the piece that caused line clears
  const now = Date.now()
  difficulty.recordPiece({
    survivalMs: pieceSpawnTime > 0 ? now - pieceSpawnTime : 2000,
    linesCleared: count,
    wasRotated: pieceWasRotated,
  })
  pieceSpawnTime = now
  pieceWasRotated = false
}

function onGameOver(stats: { score: number; linesCleared: number }) {
  // Game over mid-session — end the session early
  endSession(stats)
}

function onTimerComplete() {
  // 20 minutes elapsed — stop the game
  const gs = gameBoard.value?.gameState.value
  const stats = gs
    ? { score: gs.score, linesCleared: gs.linesCleared }
    : { score: 0, linesCleared: 0 }
  gameBoard.value?.stopGame()
  endSession(stats)
}

function endSession(stats: { score: number; linesCleared: number }) {
  finalStats.value = { ...stats, durationMs: SESSION_DURATION_MS }
  sessionTimer.value?.stop()
  phase.value = 'rating'
}

async function onSudsSelect(rating: number) {
  saving.value = true
  error.value = ''
  try {
    await suds.submitRating(rating, 'post-session')
    await useSessionService().update(sessionId.value, { completed: true })
    phase.value = 'complete'
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to save session'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!sessionId.value) {
    navigateTo('/modules/tetris/setup')
    return
  }
  nextTick(() => {
    gameBoard.value?.startGame()
    sessionTimer.value?.start()
    pieceSpawnTime = Date.now()
  })
})

onBeforeUnmount(() => {
  gameBoard.value?.stopGame()
  sessionTimer.value?.stop()
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-2 sm:px-4 py-5 sm:py-8">
    <h1 class="text-2xl font-bold mb-2">Visuospatial Interference</h1>

    <p v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </p>

    <!-- Playing phase -->
    <div v-if="phase === 'playing'" class="space-y-4">
      <SharedPhaseIndicator label="Game Session" :current="1" :total="2" />

      <SharedTimerBar
        ref="sessionTimer"
        :duration-ms="SESSION_DURATION_MS"
        @complete="onTimerComplete"
      />

      <div class="flex justify-center">
        <TetrisGameBoard
          ref="gameBoard"
          :gravity-ms="difficulty.state.value.gravityMs"
          @lines-cleared="onLinesCleared"
          @game-over="onGameOver"
        />
      </div>
    </div>

    <!-- SUDs rating phase -->
    <div v-if="phase === 'rating'" class="space-y-6">
      <SharedPhaseIndicator label="Post-Session Rating" :current="2" :total="2" />

      <div class="p-3 sm:p-6 rounded-xl bg-gray-50 dark:bg-gray-900 space-y-4">
        <h2 class="text-lg font-semibold">Session Complete</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The game session has ended. Please rate your current distress level.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-sm">
          <div>
            <span class="text-gray-500 dark:text-gray-400">Score</span>
            <p class="text-lg font-bold">{{ finalStats.score }}</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Lines</span>
            <p class="text-lg font-bold">{{ finalStats.linesCleared }}</p>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">Difficulty Adjustments</span>
            <p class="text-lg font-bold">{{ difficulty.state.value.adjustmentCount }}</p>
          </div>
        </div>
      </div>

      <SharedSudsScale :disabled="saving" @select="onSudsSelect" />
    </div>

    <!-- Completion phase -->
    <div v-if="phase === 'complete'" class="text-center py-10 sm:py-12 space-y-6">
      <div class="text-5xl">&#10003;</div>
      <h2 class="text-xl font-semibold">Session Saved</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Your session data and distress rating have been recorded.
      </p>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
        <button
          class="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          @click="navigateTo('/progress')"
        >
          View Progress
        </button>
        <button
          class="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          @click="navigateTo('/')"
        >
          Dashboard
        </button>
      </div>
    </div>
  </div>
</template>
