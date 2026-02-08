<script setup lang="ts">
definePageMeta({ layout: 'default' })

type SudsTrendItem = {
  sessionId: string
  module: string
  date: string | null
  preRating: number | null
  postRating: number | null
}

type SessionHistoryItem = {
  id: string
  module: string
  startedAt: string | null
  endedAt: string | null
  completed: boolean | null
  aborted: boolean | null
  abortReason: string | null
}

type ProgressData = {
  sessionCount: number
  completedCount: number
  abortedCount: number
  currentStreak: number
  sudsTrend: SudsTrendItem[]
  sessionHistory: SessionHistoryItem[]
  moduleStats: Record<string, { completedSessions: number; [key: string]: unknown }>
}

const loading = ref(true)
const error = ref('')
const data = ref<ProgressData | null>(null)

const moduleLabels: Record<string, string> = {
  tetris: 'Tetris',
  rtm: 'RTM',
  tnt: 'TNT',
  emdr: 'EMDR',
}

onMounted(async () => {
  try {
    data.value = await $fetch<ProgressData>('/api/progress')
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to load progress data'
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 1) return '<1 min'
  return `${mins} min`
}

// SVG chart helpers
const chartWidth = 600
const chartHeight = 200
const chartPadding = { top: 20, right: 20, bottom: 30, left: 40 }

const trendWithRatings = computed(() => {
  if (!data.value) return []
  return data.value.sudsTrend.filter(t => t.preRating !== null || t.postRating !== null)
})

function chartX(index: number, total: number): number {
  if (total <= 1) return chartPadding.left + (chartWidth - chartPadding.left - chartPadding.right) / 2
  const usable = chartWidth - chartPadding.left - chartPadding.right
  return chartPadding.left + (index / (total - 1)) * usable
}

function chartY(rating: number): number {
  const usable = chartHeight - chartPadding.top - chartPadding.bottom
  return chartPadding.top + ((10 - rating) / 10) * usable
}

function buildPolyline(key: 'preRating' | 'postRating'): string {
  const items = trendWithRatings.value
  const points: string[] = []
  for (let i = 0; i < items.length; i++) {
    const val = items[i][key]
    if (val !== null) {
      points.push(`${chartX(i, items.length)},${chartY(val)}`)
    }
  }
  return points.join(' ')
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">Progress</h1>

    <div v-if="loading" class="text-center py-12" data-testid="loading">
      <p class="text-lg text-gray-500 dark:text-gray-400">Loading progress...</p>
    </div>

    <p v-else-if="error" class="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm" data-testid="error">
      {{ error }}
    </p>

    <template v-else-if="data">
      <!-- Summary Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8" data-testid="stats">
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <p class="text-2xl font-bold" data-testid="session-count">{{ data.sessionCount }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Sessions</p>
        </div>
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <p class="text-2xl font-bold" data-testid="completed-count">{{ data.completedCount }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Completed</p>
        </div>
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <p class="text-2xl font-bold" data-testid="aborted-count">{{ data.abortedCount }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Aborted</p>
        </div>
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
          <p class="text-2xl font-bold" data-testid="streak">{{ data.currentStreak }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">Streak</p>
        </div>
      </div>

      <!-- SUDs Trend Chart -->
      <div class="mb-8" data-testid="suds-chart">
        <h2 class="text-lg font-semibold mb-3">Distress Trend (SUDs)</h2>
        <div v-if="trendWithRatings.length === 0" class="p-6 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg">
          No SUDs data yet. Complete a session to see your trend.
        </div>
        <div v-else class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto">
          <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="w-full" style="max-height: 250px">
            <!-- Y-axis labels -->
            <text
              v-for="y in [0, 2, 4, 6, 8, 10]"
              :key="`y-${y}`"
              :x="chartPadding.left - 8"
              :y="chartY(y) + 4"
              text-anchor="end"
              class="fill-gray-400 text-[11px]"
            >{{ y }}</text>
            <!-- Horizontal grid lines -->
            <line
              v-for="y in [0, 2, 4, 6, 8, 10]"
              :key="`grid-${y}`"
              :x1="chartPadding.left"
              :y1="chartY(y)"
              :x2="chartWidth - chartPadding.right"
              :y2="chartY(y)"
              class="stroke-gray-200 dark:stroke-gray-700"
              stroke-dasharray="4,4"
            />
            <!-- Pre-session line -->
            <polyline
              v-if="buildPolyline('preRating')"
              :points="buildPolyline('preRating')"
              fill="none"
              class="stroke-red-400"
              stroke-width="2"
              data-testid="pre-line"
            />
            <!-- Post-session line -->
            <polyline
              v-if="buildPolyline('postRating')"
              :points="buildPolyline('postRating')"
              fill="none"
              class="stroke-green-400"
              stroke-width="2"
              data-testid="post-line"
            />
            <!-- Pre-session dots -->
            <circle
              v-for="(item, i) in trendWithRatings"
              v-show="item.preRating !== null"
              :key="`pre-${i}`"
              :cx="chartX(i, trendWithRatings.length)"
              :cy="chartY(item.preRating ?? 0)"
              r="4"
              class="fill-red-400"
            />
            <!-- Post-session dots -->
            <circle
              v-for="(item, i) in trendWithRatings"
              v-show="item.postRating !== null"
              :key="`post-${i}`"
              :cx="chartX(i, trendWithRatings.length)"
              :cy="chartY(item.postRating ?? 0)"
              r="4"
              class="fill-green-400"
            />
            <!-- X-axis session labels -->
            <text
              v-for="(item, i) in trendWithRatings"
              :key="`x-${i}`"
              :x="chartX(i, trendWithRatings.length)"
              :y="chartHeight - 5"
              text-anchor="middle"
              class="fill-gray-400 text-[10px]"
            >{{ moduleLabels[item.module] || item.module }}</text>
          </svg>
          <div class="flex gap-4 mt-2 text-sm">
            <span class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded-full bg-red-400" /> Pre-session
            </span>
            <span class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded-full bg-green-400" /> Post-session
            </span>
          </div>
        </div>
      </div>

      <!-- Module Stats -->
      <div v-if="Object.keys(data.moduleStats).length > 0" class="mb-8" data-testid="module-stats">
        <h2 class="text-lg font-semibold mb-3">Module Stats</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            v-if="data.moduleStats.tetris"
            class="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            data-testid="stat-tetris"
          >
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tetris</p>
            <p class="text-xl font-bold">{{ data.moduleStats.tetris.completedSessions }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">sessions completed</p>
          </div>
          <div
            v-if="data.moduleStats.rtm"
            class="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            data-testid="stat-rtm"
          >
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">RTM</p>
            <p class="text-xl font-bold">{{ data.moduleStats.rtm.avgLoopsToTarget != null ? Number(data.moduleStats.rtm.avgLoopsToTarget).toFixed(1) : '—' }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">avg loops to target</p>
          </div>
          <div
            v-if="data.moduleStats.tnt"
            class="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            data-testid="stat-tnt"
          >
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">TNT</p>
            <p class="text-xl font-bold">{{ data.moduleStats.tnt.avgCompliancePct != null ? Number(data.moduleStats.tnt.avgCompliancePct).toFixed(0) + '%' : '—' }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">avg compliance</p>
          </div>
          <div
            v-if="data.moduleStats.emdr"
            class="p-4 rounded-lg border border-gray-200 dark:border-gray-700"
            data-testid="stat-emdr"
          >
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">EMDR</p>
            <p class="text-xl font-bold">{{ data.moduleStats.emdr.completedSessions }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">sessions completed</p>
          </div>
        </div>
      </div>

      <!-- Session History -->
      <div data-testid="session-history">
        <h2 class="text-lg font-semibold mb-3">Session History</h2>
        <div v-if="data.sessionHistory.length === 0" class="p-6 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg">
          No sessions yet. Start a protocol to see your history.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="session in data.sessionHistory"
            :key="session.id"
            class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between"
          >
            <div>
              <span class="font-medium">{{ moduleLabels[session.module] || session.module }}</span>
              <span class="text-sm text-gray-500 dark:text-gray-400 ml-2">{{ formatDate(session.startedAt) }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDuration(session.startedAt, session.endedAt) }}</span>
              <span
                v-if="session.completed"
                class="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                data-testid="badge-completed"
              >
                Completed
              </span>
              <span
                v-else-if="session.aborted"
                class="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                data-testid="badge-aborted"
              >
                Aborted
              </span>
              <span
                v-else
                class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                In progress
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
