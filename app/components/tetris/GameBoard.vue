<script setup lang="ts">
/**
 * Tetris GameBoard — HTML5 Canvas falling-block game.
 * Drives the game loop via usePrecisionTimer for gravity ticks.
 * Handles keyboard (arrow keys) and touch input for controls.
 */
import {
  BOARD_COLS,
  BOARD_ROWS,
  PIECE_COLOR_INDEX,
  getPieceCells,
  gravityInterval,
  type TetrisGameState,
} from '~/composables/useTetrisGame'

const props = defineProps<{
  /** Gravity interval override in ms (for adaptive difficulty). */
  gravityMs?: number
}>()

const emit = defineEmits<{
  /** Emitted when the game ends (board fills up). */
  (e: 'gameOver', stats: { score: number; linesCleared: number }): void
  /** Emitted each time lines are cleared, with count. */
  (e: 'linesCleared', count: number): void
}>()

const CELL_SIZE = 28
const CANVAS_WIDTH = BOARD_COLS * CELL_SIZE
const CANVAS_HEIGHT = BOARD_ROWS * CELL_SIZE

const COLORS: Record<number, string> = {
  0: '#1a1a2e', // empty
  1: '#00d4ff', // I - cyan
  2: '#ffdd00', // O - yellow
  3: '#b537f2', // T - purple
  4: '#00ff87', // S - green
  5: '#ff3860', // Z - red
  6: '#3273dc', // J - blue
  7: '#ff8c00', // L - orange
}

const GHOST_ALPHA = 0.25

const canvasRef = ref<HTMLCanvasElement | null>(null)
const game = useTetrisGame()
const timer = usePrecisionTimer()

const running = ref(false)
let lastDropTime = 0
let prevLinesCleared = 0

// Touch tracking
let touchStartX = 0
let touchStartY = 0
const SWIPE_THRESHOLD = 30

/** Compute the gravity interval (props override or level-based). */
function getGravityMs(): number {
  if (props.gravityMs !== undefined) return props.gravityMs
  return gravityInterval(game.state.value.level)
}

/** Draw the full board + active piece + ghost piece to canvas. */
function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const s = game.state.value

  // Clear
  ctx.fillStyle = COLORS[0]!
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Draw locked cells
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (s.board[r]![c] !== 0) {
        drawCell(ctx, r, c, COLORS[s.board[r]![c]!] ?? COLORS[0]!)
      }
    }
  }

  // Draw ghost piece
  if (s.activePiece) {
    const ghost = { ...s.activePiece }
    while (true) {
      const next = { ...ghost, row: ghost.row + 1 }
      const cells = getPieceCells(next)
      const valid = cells.every(
        ([r, c]) => r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS && s.board[r]![c] === 0,
      )
      if (!valid) break
      ghost.row = next.row
    }
    const color = COLORS[PIECE_COLOR_INDEX[s.activePiece.type]] ?? COLORS[0]!
    ctx.globalAlpha = GHOST_ALPHA
    for (const [r, c] of getPieceCells(ghost)) {
      drawCell(ctx, r, c, color)
    }
    ctx.globalAlpha = 1.0
  }

  // Draw active piece
  if (s.activePiece) {
    const color = COLORS[PIECE_COLOR_INDEX[s.activePiece.type]] ?? COLORS[0]!
    for (const [r, c] of getPieceCells(s.activePiece)) {
      drawCell(ctx, r, c, color)
    }
  }

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 0.5
  for (let r = 0; r <= BOARD_ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * CELL_SIZE)
    ctx.lineTo(CANVAS_WIDTH, r * CELL_SIZE)
    ctx.stroke()
  }
  for (let c = 0; c <= BOARD_COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * CELL_SIZE, 0)
    ctx.lineTo(c * CELL_SIZE, CANVAS_HEIGHT)
    ctx.stroke()
  }
}

function drawCell(ctx: CanvasRenderingContext2D, row: number, col: number, color: string) {
  const x = col * CELL_SIZE
  const y = row * CELL_SIZE
  ctx.fillStyle = color
  ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
  // Highlight edge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, 2)
  ctx.fillRect(x + 1, y + 1, 2, CELL_SIZE - 2)
}

/** Game loop driven by precision timer tick. */
function onTick(elapsed: number) {
  const s = game.state.value
  if (s.gameOver) {
    if (running.value) {
      running.value = false
      timer.stop()
      emit('gameOver', { score: s.score, linesCleared: s.linesCleared })
    }
    draw()
    return
  }

  // Gravity
  if (elapsed - lastDropTime >= getGravityMs()) {
    const prevLines = s.linesCleared
    game.tick()
    lastDropTime = elapsed
    const newLines = s.linesCleared - prevLines
    if (newLines > 0) {
      emit('linesCleared', newLines)
    }
  }

  draw()
}

/** Keyboard controls. */
function onKeyDown(e: KeyboardEvent) {
  if (!running.value || game.state.value.gameOver) return
  const prevLines = game.state.value.linesCleared
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      game.moveLeft()
      break
    case 'ArrowRight':
      e.preventDefault()
      game.moveRight()
      break
    case 'ArrowDown':
      e.preventDefault()
      game.softDrop()
      break
    case 'ArrowUp':
      e.preventDefault()
      game.rotate()
      break
    case ' ':
      e.preventDefault()
      game.hardDrop()
      break
  }
  // Check for line clears from hard drop
  const newLines = game.state.value.linesCleared - prevLines
  if (newLines > 0) {
    emit('linesCleared', newLines)
  }
  draw()
}

/** Touch controls. */
function onTouchStart(e: TouchEvent) {
  if (!running.value) return
  const touch = e.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function onTouchEnd(e: TouchEvent) {
  if (!running.value || game.state.value.gameOver) return
  const touch = e.changedTouches[0]
  if (!touch) return
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY

  const prevLines = game.state.value.linesCleared
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
    // Tap → rotate
    game.rotate()
  } else if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal swipe
    if (dx > 0) game.moveRight()
    else game.moveLeft()
  } else {
    // Vertical swipe
    if (dy > 0) game.hardDrop()
  }
  const newLines = game.state.value.linesCleared - prevLines
  if (newLines > 0) {
    emit('linesCleared', newLines)
  }
  draw()
}

/** Start the game. */
function startGame() {
  game.start()
  lastDropTime = 0
  prevLinesCleared = 0
  running.value = true
  timer.start()
  draw()
}

/** Stop the game (e.g., session time up). */
function stopGame() {
  running.value = false
  timer.stop()
}

// Wire up the timer tick
timer.onTick(onTick)

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  draw()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  timer.stop()
})

defineExpose({
  startGame,
  stopGame,
  gameState: game.state,
})
</script>

<template>
  <div
    class="tetris-game-board"
    role="application"
    aria-label="Falling-block game board"
  >
    <div class="board-wrapper">
      <canvas
        ref="canvasRef"
        :width="CANVAS_WIDTH"
        :height="CANVAS_HEIGHT"
        @touchstart.prevent="onTouchStart"
        @touchend.prevent="onTouchEnd"
      />
    </div>

    <div class="game-info" aria-live="polite">
      <div class="stat">
        <span class="stat-label">Score</span>
        <span class="stat-value">{{ game.state.value.score }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Lines</span>
        <span class="stat-value">{{ game.state.value.linesCleared }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Level</span>
        <span class="stat-value">{{ game.state.value.level }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Next</span>
        <span class="stat-value next-piece">{{ game.state.value.nextPiece }}</span>
      </div>
    </div>

    <div v-if="game.state.value.gameOver" class="game-over-overlay">
      <p>Game Over</p>
    </div>
  </div>
</template>

<style scoped>
.tetris-game-board {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  position: relative;
  user-select: none;
  touch-action: none;
}

.board-wrapper {
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  width: min(100%, 280px);
}

canvas {
  display: block;
  width: 100%;
  height: auto;
}

.game-info {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 1rem;
  width: 100%;
  max-width: 280px;
  min-width: 0;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  opacity: 0.6;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.next-piece {
  font-family: monospace;
}

@media (min-width: 640px) {
  .tetris-game-board {
    flex-direction: row;
    align-items: flex-start;
    gap: 1rem;
  }

  .game-info {
    flex-direction: column;
    flex-wrap: nowrap;
    justify-content: flex-start;
    width: auto;
    max-width: none;
    min-width: 80px;
    gap: 0.75rem;
  }

  .stat {
    align-items: flex-start;
    min-width: 0;
  }
}

.game-over-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
}

.game-over-overlay p {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ff3860;
}
</style>
