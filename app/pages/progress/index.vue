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
    data.value = await useProgressService().get() as ProgressData
  } catch (e: any) {
    error.value = e.data?.message || e.statusMessage || 'Failed to load progress data'
  } finally {
    loading.value = false
  }
})

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '--'
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
    const val = items[i]![key]
    if (val !== null) {
      points.push(`${chartX(i, items.length)},${chartY(val)}`)
    }
  }
  return points.join(' ')
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold">Progress</h1>
      <span class="font-mono text-xs text-gray-600 tracking-wider">// DATA ANALYSIS</span>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16" data-testid="loading">
      <div class="relative w-12 h-12">
        <div class="absolute inset-0 rounded-full border border-cyan-400/30"></div>
        <div class="absolute inset-0 rounded-full border border-cyan-400 border-t-transparent animate-spin"></div>
      </div>
      <p class="text-gray-500 ml-4 font-mono text-sm">Loading progress...</p>
    </div>

    <p v-else-if="error" class="p-3 rounded-sm bg-red-950/50 border border-red-400/20 text-red-400 text-sm font-mono" data-testid="error">
      {{ error }}
    </p>

    <template v-else-if="data">
      <!-- Summary Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8" data-testid="stats">
        <div class="p-4 rounded-sm border border-gray-700/50 bg-surface/50 text-center border-glow">
          <p class="text-2xl font-bold font-mono text-cyan-400 text-glow-cyan" data-testid="session-count">{{ data.sessionCount }}</p>
          <p class="text-xs text-gray-500 font-mono tracking-wider mt-1">SESSIONS</p>
        </div>
        <div class="p-4 rounded-sm border border-gray-700/50 bg-surface/50 text-center">
          <p class="text-2xl font-bold font-mono text-green-400" data-testid="completed-count">{{ data.completedCount }}</p>
          <p class="text-xs text-gray-500 font-mono tracking-wider mt-1">COMPLETED</p>
        </div>
        <div class="p-4 rounded-sm border border-gray-700/50 bg-surface/50 text-center">
          <p class="text-2xl font-bold font-mono text-red-400" data-testid="aborted-count">{{ data.abortedCount }}</p>
          <p class="text-xs text-gray-500 font-mono tracking-wider mt-1">ABORTED</p>
        </div>
        <div class="p-4 rounded-sm border border-gray-700/50 bg-surface/50 text-center">
          <p class="text-2xl font-bold font-mono text-yellow-400" data-testid="streak">{{ data.currentStreak }}</p>
          <p class="text-xs text-gray-500 font-mono tracking-wider mt-1">STREAK</p>
        </div>
      </div>

      <!-- SUDs Trend Chart -->
      <div class="mb-8" data-testid="suds-chart">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          Distress Trend (SUDs)
        </h2>
        <div v-if="trendWithRatings.length === 0" class="p-6 text-center text-gray-500 font-mono text-sm border border-gray-700/30 rounded-sm bg-surface/30">
          > No SUDs data yet. Complete a session to see your trend._
        </div>
        <div v-else class="border border-gray-700/30 rounded-sm p-4 overflow-x-auto bg-surface/30">
          <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="w-full" style="max-height: 250px">
            <!-- Y-axis labels -->
            <text
              v-for="y in [0, 2, 4, 6, 8, 10]"
              :key="`y-${y}`"
              :x="chartPadding.left - 8"
              :y="chartY(y) + 4"
              text-anchor="end"
              class="fill-gray-500 text-[11px]"
              style="font-family: 'JetBrains Mono Variable', monospace"
            >{{ y }}</text>
            <!-- Horizontal grid lines -->
            <line
              v-for="y in [0, 2, 4, 6, 8, 10]"
              :key="`grid-${y}`"
              :x1="chartPadding.left"
              :y1="chartY(y)"
              :x2="chartWidth - chartPadding.right"
              :y2="chartY(y)"
              stroke="rgba(44, 46, 70, 0.5)"
              stroke-dasharray="4,4"
            />
            <!-- Pre-session line (magenta) -->
            <polyline
              v-if="buildPolyline('preRating')"
              :points="buildPolyline('preRating')"
              fill="none"
              stroke="#ff2d7b"
              stroke-width="2"
              data-testid="pre-line"
            />
            <!-- Post-session line (green) -->
            <polyline
              v-if="buildPolyline('postRating')"
              :points="buildPolyline('postRating')"
              fill="none"
              stroke="#00ff87"
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
              fill="#ff2d7b"
            />
            <!-- Post-session dots -->
            <circle
              v-for="(item, i) in trendWithRatings"
              v-show="item.postRating !== null"
              :key="`post-${i}`"
              :cx="chartX(i, trendWithRatings.length)"
              :cy="chartY(item.postRating ?? 0)"
              r="4"
              fill="#00ff87"
            />
            <!-- X-axis session labels -->
            <text
              v-for="(item, i) in trendWithRatings"
              :key="`x-${i}`"
              :x="chartX(i, trendWithRatings.length)"
              :y="chartHeight - 5"
              text-anchor="middle"
              class="fill-gray-500 text-[10px]"
              style="font-family: 'JetBrains Mono Variable', monospace"
            >{{ moduleLabels[item.module] || item.module }}</text>
          </svg>
          <div class="flex flex-wrap gap-4 mt-2 text-xs font-mono">
            <span class="flex items-center gap-1.5">
              <span class="inline-block w-3 h-0.5 bg-red-400" /> Pre-session
            </span>
            <span class="flex items-center gap-1.5">
              <span class="inline-block w-3 h-0.5 bg-green-400" /> Post-session
            </span>
          </div>
        </div>
      </div>

      <!-- Module Stats -->
      <div v-if="Object.keys(data.moduleStats).length > 0" class="mb-8" data-testid="module-stats">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          Module Stats
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            v-if="data.moduleStats.tetris"
            class="p-4 rounded-sm border border-gray-700/50 bg-surface/50"
            data-testid="stat-tetris"
          >
            <p class="text-xs font-mono text-gray-500 tracking-wider mb-1">TETRIS</p>
            <p class="text-xl font-bold font-mono text-cyan-400">{{ data.moduleStats.tetris.completedSessions }}</p>
            <p class="text-xs text-gray-500">sessions completed</p>
          </div>
          <div
            v-if="data.moduleStats.rtm"
            class="p-4 rounded-sm border border-gray-700/50 bg-surface/50"
            data-testid="stat-rtm"
          >
            <p class="text-xs font-mono text-gray-500 tracking-wider mb-1">RTM</p>
            <p class="text-xl font-bold font-mono text-cyan-400">{{ data.moduleStats.rtm.avgLoopsToTarget != null ? Number(data.moduleStats.rtm.avgLoopsToTarget).toFixed(1) : '--' }}</p>
            <p class="text-xs text-gray-500">avg loops to target</p>
          </div>
          <div
            v-if="data.moduleStats.tnt"
            class="p-4 rounded-sm border border-gray-700/50 bg-surface/50"
            data-testid="stat-tnt"
          >
            <p class="text-xs font-mono text-gray-500 tracking-wider mb-1">TNT</p>
            <p class="text-xl font-bold font-mono text-cyan-400">{{ data.moduleStats.tnt.avgCompliancePct != null ? Number(data.moduleStats.tnt.avgCompliancePct).toFixed(0) + '%' : '--' }}</p>
            <p class="text-xs text-gray-500">avg compliance</p>
          </div>
          <div
            v-if="data.moduleStats.emdr"
            class="p-4 rounded-sm border border-gray-700/50 bg-surface/50"
            data-testid="stat-emdr"
          >
            <p class="text-xs font-mono text-gray-500 tracking-wider mb-1">EMDR</p>
            <p class="text-xl font-bold font-mono text-cyan-400">{{ data.moduleStats.emdr.completedSessions }}</p>
            <p class="text-xs text-gray-500">sessions completed</p>
          </div>
        </div>
      </div>

      <!-- Session History -->
      <div data-testid="session-history">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          Session History
        </h2>
        <div v-if="data.sessionHistory.length === 0" class="p-6 text-center text-gray-500 font-mono text-sm border border-gray-700/30 rounded-sm bg-surface/30">
          > No sessions yet. Start a protocol to see your history._
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="session in data.sessionHistory"
            :key="session.id"
            class="p-3 rounded-sm border border-gray-700/50 bg-surface/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-gray-600/50 transition-colors"
          >
            <div>
              <span class="font-medium">{{ moduleLabels[session.module] || session.module }}</span>
              <span class="block sm:inline text-sm text-gray-500 font-mono sm:ml-2">{{ formatDate(session.startedAt) }}</span>
            </div>
            <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span class="text-sm text-gray-500 font-mono">{{ formatDuration(session.startedAt, session.endedAt) }}</span>
              <span
                v-if="session.completed"
                class="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider px-2 py-0.5 rounded-sm bg-green-400/10 border border-green-400/20 text-green-400"
                data-testid="badge-completed"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px] shadow-green-400"></span>
                COMPLETED
              </span>
              <span
                v-else-if="session.aborted"
                class="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider px-2 py-0.5 rounded-sm bg-red-400/10 border border-red-400/20 text-red-400"
                data-testid="badge-aborted"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_4px] shadow-red-400"></span>
                ABORTED
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1.5 text-xs font-mono tracking-wider px-2 py-0.5 rounded-sm bg-gray-700/50 border border-gray-600/30 text-gray-400"
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
