/**
 * Core Tetris game logic composable.
 * Manages board state, piece movement, collision detection, line clearing,
 * and gravity. Rendering is handled separately by GameBoard.vue.
 */

export const BOARD_COLS = 10
export const BOARD_ROWS = 20
export const EMPTY_CELL = 0

/** Standard 7 tetrominoes defined as rotation states (row, col offsets). */
export const TETROMINOES: Record<string, number[][][]> = {
  I: [
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
  ],
  O: [
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
  ],
  T: [
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [1, 1], [1, 2], [0, 1]],
    [[0, 0], [1, 0], [2, 0], [1, -1]],
  ],
  S: [
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ],
  Z: [
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
  ],
  J: [
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [2, -1]],
  ],
  L: [
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
  ],
}

const PIECE_TYPES = Object.keys(TETROMINOES) as PieceType[]

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

/** Color index for each piece type (1-7, 0 = empty). */
export const PIECE_COLOR_INDEX: Record<PieceType, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
}

export interface ActivePiece {
  type: PieceType
  rotation: number
  row: number
  col: number
}

export type Board = number[][]

export interface TetrisGameState {
  board: Board
  activePiece: ActivePiece | null
  nextPiece: PieceType
  score: number
  linesCleared: number
  gameOver: boolean
  level: number
}

/** Create an empty board. */
export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => EMPTY_CELL),
  )
}

/** Get the absolute cell positions of a piece on the board. */
export function getPieceCells(piece: ActivePiece): [number, number][] {
  const offsets = TETROMINOES[piece.type][piece.rotation]
  return offsets.map(([dr, dc]) => [piece.row + dr, piece.col + dc])
}

/** Check if a piece placement is valid (no collisions, in bounds). */
export function isValidPosition(board: Board, piece: ActivePiece): boolean {
  const cells = getPieceCells(piece)
  for (const [r, c] of cells) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false
    if (board[r][c] !== EMPTY_CELL) return false
  }
  return true
}

/** Lock the active piece into the board by writing its color index. */
export function lockPiece(board: Board, piece: ActivePiece): void {
  const colorIdx = PIECE_COLOR_INDEX[piece.type]
  for (const [r, c] of getPieceCells(piece)) {
    board[r][c] = colorIdx
  }
}

/** Clear completed lines and return the number cleared. */
export function clearLines(board: Board): number {
  let cleared = 0
  for (let r = BOARD_ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== EMPTY_CELL)) {
      board.splice(r, 1)
      board.unshift(Array.from({ length: BOARD_COLS }, () => EMPTY_CELL))
      cleared++
      r++ // Re-check this row index since rows shifted down
    }
  }
  return cleared
}

/** Pick a random piece type using a provided RNG (defaults to Math.random). */
export function randomPieceType(rng: () => number = Math.random): PieceType {
  return PIECE_TYPES[Math.floor(rng() * PIECE_TYPES.length)]
}

/** Create a new active piece at the top-center of the board. */
export function spawnPiece(type: PieceType): ActivePiece {
  return {
    type,
    rotation: 0,
    row: 0,
    col: Math.floor((BOARD_COLS - 2) / 2), // Roughly centered
  }
}

/** Scoring: lines → points (classic NES-style). */
function scoreForLines(lines: number, level: number): number {
  const base = [0, 40, 100, 300, 1200]
  return (base[lines] ?? 0) * (level + 1)
}

/** Gravity interval in ms for a given level. */
export function gravityInterval(level: number): number {
  // Classic Tetris: starts at 800ms, gets faster
  return Math.max(100, 800 - level * 60)
}

/**
 * Main composable. Returns reactive game state and control methods.
 * The caller (GameBoard.vue) drives the game loop via usePrecisionTimer
 * and calls `tick()` at the gravity interval.
 */
export function useTetrisGame(rng: () => number = Math.random) {
  const state = ref<TetrisGameState>({
    board: createEmptyBoard(),
    activePiece: null,
    nextPiece: randomPieceType(rng),
    score: 0,
    linesCleared: 0,
    gameOver: false,
    level: 1,
  })

  /** Internal: spawn the next piece; end game if it collides immediately. */
  function _spawnNext() {
    const s = state.value
    const piece = spawnPiece(s.nextPiece)
    if (!isValidPosition(s.board, piece)) {
      s.gameOver = true
      return
    }
    s.activePiece = piece
    s.nextPiece = randomPieceType(rng)
  }

  /** Start a new game. */
  function start() {
    state.value = {
      board: createEmptyBoard(),
      activePiece: null,
      nextPiece: randomPieceType(rng),
      score: 0,
      linesCleared: 0,
      gameOver: false,
      level: 1,
    }
    _spawnNext()
  }

  /** Try moving the active piece. Returns true if move succeeded. */
  function tryMove(dRow: number, dCol: number): boolean {
    const s = state.value
    if (!s.activePiece || s.gameOver) return false
    const moved: ActivePiece = {
      ...s.activePiece,
      row: s.activePiece.row + dRow,
      col: s.activePiece.col + dCol,
    }
    if (isValidPosition(s.board, moved)) {
      s.activePiece = moved
      return true
    }
    return false
  }

  /** Try rotating the active piece. Returns true if rotation succeeded. */
  function tryRotate(): boolean {
    const s = state.value
    if (!s.activePiece || s.gameOver) return false
    const rotated: ActivePiece = {
      ...s.activePiece,
      rotation: (s.activePiece.rotation + 1) % 4,
    }
    if (isValidPosition(s.board, rotated)) {
      s.activePiece = rotated
      return true
    }
    // Simple wall kick: try shifting left/right by 1
    for (const kick of [-1, 1, -2, 2]) {
      const kicked: ActivePiece = { ...rotated, col: rotated.col + kick }
      if (isValidPosition(s.board, kicked)) {
        s.activePiece = kicked
        return true
      }
    }
    return false
  }

  /** Hard drop: move piece down until it locks. Returns rows dropped. */
  function hardDrop(): number {
    const s = state.value
    if (!s.activePiece || s.gameOver) return 0
    let dropped = 0
    while (tryMove(1, 0)) {
      dropped++
    }
    _lockAndClear()
    return dropped
  }

  /** Lock current piece and clear lines. */
  function _lockAndClear() {
    const s = state.value
    if (!s.activePiece) return
    lockPiece(s.board, s.activePiece)
    const lines = clearLines(s.board)
    s.linesCleared += lines
    s.score += scoreForLines(lines, s.level)
    s.level = Math.floor(s.linesCleared / 10) + 1
    s.activePiece = null
    _spawnNext()
  }

  /** Gravity tick: move piece down one row, or lock if can't. */
  function tick() {
    const s = state.value
    if (!s.activePiece || s.gameOver) return
    if (!tryMove(1, 0)) {
      _lockAndClear()
    }
  }

  /** Move left. */
  function moveLeft() { tryMove(0, -1) }

  /** Move right. */
  function moveRight() { tryMove(0, 1) }

  /** Soft drop (one row down). */
  function softDrop() { tryMove(1, 0) }

  /** Rotate. */
  function rotate() { tryRotate() }

  return {
    state: readonly(state),
    start,
    tick,
    moveLeft,
    moveRight,
    softDrop,
    hardDrop,
    rotate,
  }
}
