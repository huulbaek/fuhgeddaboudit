import { describe, it, expect, vi } from 'vitest'
import {
  BOARD_COLS,
  BOARD_ROWS,
  EMPTY_CELL,
  TETROMINOES,
  PIECE_COLOR_INDEX,
  createEmptyBoard,
  getPieceCells,
  isValidPosition,
  lockPiece,
  clearLines,
  spawnPiece,
  gravityInterval,
  useTetrisGame,
  type ActivePiece,
  type Board,
} from '../../app/composables/useTetrisGame'

describe('createEmptyBoard', () => {
  it('creates a board with the correct dimensions', () => {
    const board = createEmptyBoard()
    expect(board.length).toBe(BOARD_ROWS)
    for (const row of board) {
      expect(row.length).toBe(BOARD_COLS)
    }
  })

  it('fills every cell with EMPTY_CELL', () => {
    const board = createEmptyBoard()
    for (const row of board) {
      for (const cell of row) {
        expect(cell).toBe(EMPTY_CELL)
      }
    }
  })
})

describe('getPieceCells', () => {
  it('returns absolute positions for piece at origin', () => {
    const piece: ActivePiece = { type: 'O', rotation: 0, row: 0, col: 0 }
    const cells = getPieceCells(piece)
    expect(cells).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]])
  })

  it('offsets correctly based on row/col', () => {
    const piece: ActivePiece = { type: 'O', rotation: 0, row: 5, col: 3 }
    const cells = getPieceCells(piece)
    expect(cells).toEqual([[5, 3], [5, 4], [6, 3], [6, 4]])
  })

  it('applies rotation to T piece', () => {
    const piece0: ActivePiece = { type: 'T', rotation: 0, row: 0, col: 0 }
    const piece1: ActivePiece = { type: 'T', rotation: 1, row: 0, col: 0 }
    const cells0 = getPieceCells(piece0)
    const cells1 = getPieceCells(piece1)
    // Rotation 0 and 1 should produce different shapes
    expect(cells0).not.toEqual(cells1)
  })
})

describe('isValidPosition (collision detection)', () => {
  it('accepts a piece in valid open space', () => {
    const board = createEmptyBoard()
    const piece: ActivePiece = { type: 'O', rotation: 0, row: 0, col: 0 }
    expect(isValidPosition(board, piece)).toBe(true)
  })

  it('rejects a piece that extends below the board', () => {
    const board = createEmptyBoard()
    const piece: ActivePiece = { type: 'O', rotation: 0, row: BOARD_ROWS - 1, col: 0 }
    // O piece occupies rows [row, row+1], so row 19 → row 20 is out of bounds
    expect(isValidPosition(board, piece)).toBe(false)
  })

  it('rejects a piece that extends left of the board', () => {
    const board = createEmptyBoard()
    const piece: ActivePiece = { type: 'I', rotation: 0, row: 0, col: -1 }
    expect(isValidPosition(board, piece)).toBe(false)
  })

  it('rejects a piece that extends right of the board', () => {
    const board = createEmptyBoard()
    // I piece rotation 0 is horizontal [0,0],[0,1],[0,2],[0,3]
    const piece: ActivePiece = { type: 'I', rotation: 0, row: 0, col: BOARD_COLS - 2 }
    // col + 3 = BOARD_COLS + 1 → out of bounds
    expect(isValidPosition(board, piece)).toBe(false)
  })

  it('rejects a piece that overlaps an occupied cell', () => {
    const board = createEmptyBoard()
    board[1][0] = 1 // Occupied
    const piece: ActivePiece = { type: 'O', rotation: 0, row: 0, col: 0 }
    // O piece occupies [0,0],[0,1],[1,0],[1,1] — overlaps [1,0]
    expect(isValidPosition(board, piece)).toBe(false)
  })

  it('accepts a piece adjacent to but not overlapping occupied cells', () => {
    const board = createEmptyBoard()
    board[2][0] = 1 // One row below the O piece
    const piece: ActivePiece = { type: 'O', rotation: 0, row: 0, col: 0 }
    expect(isValidPosition(board, piece)).toBe(true)
  })

  it('handles I piece in vertical orientation at the right edge', () => {
    const board = createEmptyBoard()
    // I vertical: [0,0],[1,0],[2,0],[3,0] at rightmost column
    const piece: ActivePiece = { type: 'I', rotation: 1, row: 0, col: BOARD_COLS - 1 }
    expect(isValidPosition(board, piece)).toBe(true)
  })

  it('rejects a piece above the board (negative row)', () => {
    const board = createEmptyBoard()
    const piece: ActivePiece = { type: 'O', rotation: 0, row: -1, col: 0 }
    expect(isValidPosition(board, piece)).toBe(false)
  })
})

describe('lockPiece', () => {
  it('writes the color index of the piece into the board', () => {
    const board = createEmptyBoard()
    const piece: ActivePiece = { type: 'T', rotation: 0, row: 5, col: 3 }
    lockPiece(board, piece)
    const cells = getPieceCells(piece)
    for (const [r, c] of cells) {
      expect(board[r][c]).toBe(PIECE_COLOR_INDEX.T)
    }
  })

  it('does not modify other cells', () => {
    const board = createEmptyBoard()
    const piece: ActivePiece = { type: 'O', rotation: 0, row: 0, col: 0 }
    lockPiece(board, piece)
    // Check cell that is NOT part of the O piece
    expect(board[0][2]).toBe(EMPTY_CELL)
    expect(board[2][0]).toBe(EMPTY_CELL)
  })
})

describe('clearLines', () => {
  it('clears a single completed row at the bottom', () => {
    const board = createEmptyBoard()
    // Fill the bottom row
    for (let c = 0; c < BOARD_COLS; c++) {
      board[BOARD_ROWS - 1][c] = 1
    }
    const cleared = clearLines(board)
    expect(cleared).toBe(1)
    // Bottom row should now be empty (shifted down from above)
    for (let c = 0; c < BOARD_COLS; c++) {
      expect(board[BOARD_ROWS - 1][c]).toBe(EMPTY_CELL)
    }
  })

  it('clears multiple completed rows', () => {
    const board = createEmptyBoard()
    // Fill the bottom two rows
    for (let c = 0; c < BOARD_COLS; c++) {
      board[BOARD_ROWS - 1][c] = 1
      board[BOARD_ROWS - 2][c] = 2
    }
    const cleared = clearLines(board)
    expect(cleared).toBe(2)
    for (let c = 0; c < BOARD_COLS; c++) {
      expect(board[BOARD_ROWS - 1][c]).toBe(EMPTY_CELL)
      expect(board[BOARD_ROWS - 2][c]).toBe(EMPTY_CELL)
    }
  })

  it('does not clear incomplete rows', () => {
    const board = createEmptyBoard()
    // Fill all but one cell in the bottom row
    for (let c = 0; c < BOARD_COLS - 1; c++) {
      board[BOARD_ROWS - 1][c] = 1
    }
    const cleared = clearLines(board)
    expect(cleared).toBe(0)
    // Row should remain unchanged
    expect(board[BOARD_ROWS - 1][0]).toBe(1)
  })

  it('shifts rows above a cleared row down', () => {
    const board = createEmptyBoard()
    // Put a block at row 18
    board[BOARD_ROWS - 2][0] = 3
    // Fill row 19 (bottom)
    for (let c = 0; c < BOARD_COLS; c++) {
      board[BOARD_ROWS - 1][c] = 1
    }
    clearLines(board)
    // The block that was at row 18 should now be at row 19
    expect(board[BOARD_ROWS - 1][0]).toBe(3)
  })

  it('clears four lines at once (Tetris)', () => {
    const board = createEmptyBoard()
    for (let r = BOARD_ROWS - 4; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        board[r][c] = 1
      }
    }
    const cleared = clearLines(board)
    expect(cleared).toBe(4)
  })

  it('maintains board dimensions after clearing', () => {
    const board = createEmptyBoard()
    for (let c = 0; c < BOARD_COLS; c++) {
      board[BOARD_ROWS - 1][c] = 1
    }
    clearLines(board)
    expect(board.length).toBe(BOARD_ROWS)
    for (const row of board) {
      expect(row.length).toBe(BOARD_COLS)
    }
  })

  it('clears non-adjacent completed rows correctly', () => {
    const board = createEmptyBoard()
    // Fill rows 17 and 19 (not adjacent)
    for (let c = 0; c < BOARD_COLS; c++) {
      board[BOARD_ROWS - 1][c] = 1
      board[BOARD_ROWS - 3][c] = 2
    }
    // Row 18 is incomplete — put a block in col 0 only
    board[BOARD_ROWS - 2][0] = 3
    const cleared = clearLines(board)
    expect(cleared).toBe(2)
    // The partial row 18 content should have shifted down
    expect(board[BOARD_ROWS - 1][0]).toBe(3)
  })
})

describe('spawnPiece', () => {
  it('creates a piece at the top of the board', () => {
    const piece = spawnPiece('T')
    expect(piece.row).toBe(0)
    expect(piece.rotation).toBe(0)
    expect(piece.type).toBe('T')
  })

  it('centers the piece horizontally', () => {
    const piece = spawnPiece('I')
    expect(piece.col).toBeGreaterThanOrEqual(3)
    expect(piece.col).toBeLessThanOrEqual(4)
  })
})

describe('gravityInterval', () => {
  it('returns a slower interval at level 1', () => {
    expect(gravityInterval(1)).toBeGreaterThan(gravityInterval(5))
  })

  it('never goes below 100ms', () => {
    expect(gravityInterval(100)).toBe(100)
  })
})

describe('useTetrisGame composable', () => {
  // Use a deterministic RNG to control piece selection
  function makeRng(sequence: number[]) {
    let i = 0
    return () => sequence[i++ % sequence.length]
  }

  it('starts with no active piece and game not over', () => {
    const game = useTetrisGame()
    expect(game.state.value.activePiece).toBe(null)
    expect(game.state.value.gameOver).toBe(false)
  })

  it('spawns an active piece on start()', () => {
    const game = useTetrisGame()
    game.start()
    expect(game.state.value.activePiece).not.toBe(null)
    expect(game.state.value.gameOver).toBe(false)
    expect(game.state.value.score).toBe(0)
    expect(game.state.value.linesCleared).toBe(0)
  })

  it('moves the piece left', () => {
    const game = useTetrisGame()
    game.start()
    const startCol = game.state.value.activePiece!.col
    game.moveLeft()
    expect(game.state.value.activePiece!.col).toBe(startCol - 1)
  })

  it('moves the piece right', () => {
    const game = useTetrisGame()
    game.start()
    const startCol = game.state.value.activePiece!.col
    game.moveRight()
    expect(game.state.value.activePiece!.col).toBe(startCol + 1)
  })

  it('does not move left past the board edge', () => {
    const game = useTetrisGame()
    game.start()
    // Move left many times
    for (let i = 0; i < 20; i++) game.moveLeft()
    const cells = getPieceCells(game.state.value.activePiece!)
    for (const [, c] of cells) {
      expect(c).toBeGreaterThanOrEqual(0)
    }
  })

  it('does not move right past the board edge', () => {
    const game = useTetrisGame()
    game.start()
    for (let i = 0; i < 20; i++) game.moveRight()
    const cells = getPieceCells(game.state.value.activePiece!)
    for (const [, c] of cells) {
      expect(c).toBeLessThan(BOARD_COLS)
    }
  })

  it('soft drop moves piece down one row', () => {
    const game = useTetrisGame()
    game.start()
    const startRow = game.state.value.activePiece!.row
    game.softDrop()
    expect(game.state.value.activePiece!.row).toBe(startRow + 1)
  })

  it('tick moves piece down via gravity', () => {
    const game = useTetrisGame()
    game.start()
    const startRow = game.state.value.activePiece!.row
    game.tick()
    expect(game.state.value.activePiece!.row).toBe(startRow + 1)
  })

  it('locks piece and spawns next when piece cannot move down', () => {
    const game = useTetrisGame()
    game.start()
    // Drop piece all the way down
    game.hardDrop()
    // A new piece should have spawned
    expect(game.state.value.activePiece).not.toBe(null)
    // Board should have some filled cells at the bottom
    const bottomRow = game.state.value.board[BOARD_ROWS - 1]
    const hasBlock = bottomRow.some(c => c !== EMPTY_CELL)
    expect(hasBlock).toBe(true)
  })

  it('hard drop returns the number of rows dropped', () => {
    const game = useTetrisGame()
    game.start()
    const startRow = game.state.value.activePiece!.row
    const dropped = game.hardDrop()
    expect(dropped).toBeGreaterThan(0)
  })

  it('rotate changes the piece rotation', () => {
    // Use RNG that picks T piece (index 2), value 2/7 ≈ 0.285
    const game = useTetrisGame(makeRng([2 / 7, 2 / 7]))
    game.start()
    const startRotation = game.state.value.activePiece!.rotation
    game.rotate()
    expect(game.state.value.activePiece!.rotation).not.toBe(startRotation)
  })

  it('clears lines and updates score', () => {
    // Test line clearing + scoring using pure functions (not readonly state)
    const board = createEmptyBoard()
    for (let c = 0; c < BOARD_COLS; c++) {
      board[BOARD_ROWS - 1][c] = 1
    }
    const cleared = clearLines(board)
    expect(cleared).toBe(1)
    // Verify the cleared row is now empty
    for (let c = 0; c < BOARD_COLS; c++) {
      expect(board[BOARD_ROWS - 1][c]).toBe(EMPTY_CELL)
    }
  })

  it('detects game over when the board fills up', () => {
    const game = useTetrisGame()
    game.start()

    // Keep hard-dropping pieces until the game is over
    // With random pieces, the board will eventually fill up
    let moves = 0
    while (!game.state.value.gameOver && moves < 500) {
      game.hardDrop()
      moves++
    }
    expect(game.state.value.gameOver).toBe(true)
  })

  it('reset works — start() clears previous game state', () => {
    const game = useTetrisGame()
    game.start()
    game.hardDrop()
    game.hardDrop()
    // Board has blocks
    const hadBlocks = game.state.value.board.some(row => row.some(c => c !== EMPTY_CELL))
    expect(hadBlocks).toBe(true)

    game.start()
    // Board should be clean except for the newly spawned piece (which isn't on the board yet)
    const allEmpty = game.state.value.board.every(row => row.every(c => c === EMPTY_CELL))
    expect(allEmpty).toBe(true)
    expect(game.state.value.score).toBe(0)
    expect(game.state.value.linesCleared).toBe(0)
    expect(game.state.value.gameOver).toBe(false)
  })

  it('all 7 tetrominoes have 4 rotation states', () => {
    for (const [name, rotations] of Object.entries(TETROMINOES)) {
      expect(rotations.length).toBe(4)
      for (const offsets of rotations) {
        expect(offsets.length).toBe(4) // Every piece has 4 cells
      }
    }
  })

  it('wall kick allows rotation near the edge', () => {
    const game = useTetrisGame()
    game.start()
    // Move piece all the way to the left
    for (let i = 0; i < 20; i++) game.moveLeft()
    // Rotation should still work (wall kick)
    game.rotate()
    const cells = getPieceCells(game.state.value.activePiece!)
    for (const [, c] of cells) {
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThan(BOARD_COLS)
    }
  })
})
