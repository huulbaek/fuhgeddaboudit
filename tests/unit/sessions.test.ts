import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// --- Schema definitions (mirrored from route files) ---

const createSessionSchema = z.object({
  module: z.enum(['tnt', 'rtm', 'tetris', 'emdr', 'preparation']),
})

const updateSessionSchema = z.object({
  suds: z
    .object({
      rating: z.number().int().min(0).max(10),
      phase: z.string().max(20),
    })
    .optional(),
  completed: z.boolean().optional(),
  aborted: z.boolean().optional(),
  abortReason: z
    .enum(['suds_no_change', 'user_panic', 'gaze_lost'])
    .optional(),
})

// --- Create session validation ---

describe('create session validation', () => {
  it('accepts a valid tetris session', () => {
    const result = createSessionSchema.safeParse({ module: 'tetris' })
    expect(result.success).toBe(true)
  })

  it('accepts all valid module types', () => {
    for (const module of ['tnt', 'rtm', 'tetris', 'emdr', 'preparation']) {
      const result = createSessionSchema.safeParse({ module })
      expect(result.success).toBe(true)
    }
  })

  it('rejects an invalid module type', () => {
    const result = createSessionSchema.safeParse({ module: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing module', () => {
    const result = createSessionSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects empty string module', () => {
    const result = createSessionSchema.safeParse({ module: '' })
    expect(result.success).toBe(false)
  })
})

// --- Update session validation ---

describe('update session validation', () => {
  it('accepts a valid SUDs rating', () => {
    const result = updateSessionSchema.safeParse({
      suds: { rating: 5, phase: 'pre' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts completion update', () => {
    const result = updateSessionSchema.safeParse({ completed: true })
    expect(result.success).toBe(true)
  })

  it('accepts abort update with reason', () => {
    const result = updateSessionSchema.safeParse({
      aborted: true,
      abortReason: 'user_panic',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid abort reasons', () => {
    for (const reason of ['suds_no_change', 'user_panic', 'gaze_lost']) {
      const result = updateSessionSchema.safeParse({
        aborted: true,
        abortReason: reason,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts SUDs combined with completion', () => {
    const result = updateSessionSchema.safeParse({
      suds: { rating: 2, phase: 'post' },
      completed: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty body (no updates)', () => {
    const result = updateSessionSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects SUDs rating below 0', () => {
    const result = updateSessionSchema.safeParse({
      suds: { rating: -1, phase: 'pre' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects SUDs rating above 10', () => {
    const result = updateSessionSchema.safeParse({
      suds: { rating: 11, phase: 'pre' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer SUDs rating', () => {
    const result = updateSessionSchema.safeParse({
      suds: { rating: 5.5, phase: 'pre' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects SUDs without phase', () => {
    const result = updateSessionSchema.safeParse({
      suds: { rating: 5 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid abort reason', () => {
    const result = updateSessionSchema.safeParse({
      abortReason: 'not_a_valid_reason',
    })
    expect(result.success).toBe(false)
  })

  it('rejects SUDs phase exceeding max length', () => {
    const result = updateSessionSchema.safeParse({
      suds: { rating: 5, phase: 'a'.repeat(21) },
    })
    expect(result.success).toBe(false)
  })
})

// --- Get session business logic ---

describe('get session business logic', () => {
  type Session = {
    id: string
    module: string
    completed: boolean
    aborted: boolean
  } | null

  function evaluateGetRequest(sessionId: string | undefined, session: Session) {
    if (!sessionId) {
      return { error: 400, message: 'Session ID is required' }
    }
    if (!session) {
      return { error: 404, message: 'Session not found' }
    }
    return { result: session }
  }

  it('returns 400 when session ID is missing', () => {
    const result = evaluateGetRequest(undefined, null)
    expect(result.error).toBe(400)
  })

  it('returns 404 when session does not exist', () => {
    const result = evaluateGetRequest('some-uuid', null)
    expect(result.error).toBe(404)
  })

  it('returns session when found', () => {
    const session = { id: 'abc', module: 'tetris', completed: false, aborted: false }
    const result = evaluateGetRequest('abc', session)
    expect(result.result).toEqual(session)
  })
})

// --- Patch session business logic ---

describe('patch session business logic', () => {
  type Session = { id: string } | null
  type UpdateData = {
    suds?: { rating: number; phase: string }
    completed?: boolean
    aborted?: boolean
    abortReason?: string
  }

  function evaluatePatchRequest(sessionId: string | undefined, session: Session, data: UpdateData) {
    if (!sessionId) {
      return { error: 400, message: 'Session ID is required' }
    }
    if (!session) {
      return { error: 404, message: 'Session not found' }
    }

    const updates: Record<string, unknown> = {}
    if (data.completed !== undefined) {
      updates.completed = data.completed
      updates.endedAt = 'now'
    }
    if (data.aborted !== undefined) {
      updates.aborted = data.aborted
      updates.endedAt = 'now'
    }
    if (data.abortReason !== undefined) {
      updates.abortReason = data.abortReason
    }

    return {
      sudsInserted: !!data.suds,
      sessionUpdated: Object.keys(updates).length > 0,
      updates,
    }
  }

  it('returns 400 when session ID is missing', () => {
    const result = evaluatePatchRequest(undefined, null, {})
    expect(result.error).toBe(400)
  })

  it('returns 404 when session does not exist', () => {
    const result = evaluatePatchRequest('some-uuid', null, {})
    expect(result.error).toBe(404)
  })

  it('inserts SUDs rating when provided', () => {
    const result = evaluatePatchRequest('id', { id: 'id' }, {
      suds: { rating: 5, phase: 'pre' },
    })
    expect(result.sudsInserted).toBe(true)
    expect(result.sessionUpdated).toBe(false)
  })

  it('sets endedAt when completing a session', () => {
    const result = evaluatePatchRequest('id', { id: 'id' }, { completed: true })
    expect(result.updates!.completed).toBe(true)
    expect(result.updates!.endedAt).toBe('now')
  })

  it('sets endedAt when aborting a session', () => {
    const result = evaluatePatchRequest('id', { id: 'id' }, {
      aborted: true,
      abortReason: 'user_panic',
    })
    expect(result.updates!.aborted).toBe(true)
    expect(result.updates!.abortReason).toBe('user_panic')
    expect(result.updates!.endedAt).toBe('now')
  })

  it('does not update session when only SUDs is provided', () => {
    const result = evaluatePatchRequest('id', { id: 'id' }, {
      suds: { rating: 3, phase: 'mid_loop_1' },
    })
    expect(result.sessionUpdated).toBe(false)
  })

  it('handles combined SUDs and completion', () => {
    const result = evaluatePatchRequest('id', { id: 'id' }, {
      suds: { rating: 2, phase: 'post' },
      completed: true,
    })
    expect(result.sudsInserted).toBe(true)
    expect(result.sessionUpdated).toBe(true)
    expect(result.updates!.completed).toBe(true)
  })
})
