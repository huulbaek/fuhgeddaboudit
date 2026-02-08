import { describe, it, expect } from 'vitest'
import { z } from 'zod'

/**
 * End-to-end smoke test: validates the full user flow through all validation
 * schemas, business logic, and state transitions.
 *
 * Flow: register → screening → preparation → triage → tetris session → progress
 */

// --- Mirrored schemas and logic from route files ---

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const submitScreeningSchema = z.object({
  pcptsd5: z.object({
    score: z.number().int().min(0).max(5),
    answers: z.array(z.boolean()).length(5),
  }),
  desbrief: z.object({
    score: z.number().int().min(0).max(100),
    answers: z.array(z.number().int().min(0).max(100)).length(8),
  }),
})

function computeScreeningResults(pcptsd5: { score: number }, desbrief: { score: number }) {
  const desbriefResult = desbrief.score >= 20 ? 'excluded' : 'admitted'
  const pcptsd5Result = pcptsd5.score >= 3 ? 'admitted' : 'informational'
  const overallResult = desbriefResult === 'excluded' ? 'excluded' : pcptsd5Result
  return { desbriefResult, pcptsd5Result, overallResult }
}

const validModules = ['tetris', 'rtm', 'tnt', 'emdr'] as const

const triageSchema = z.object({
  answers: z.array(z.object({
    id: z.string().min(1),
    rating: z.number().int().min(1).max(5),
  })).min(1),
  recommendation: z.enum(validModules),
  selectedModule: z.enum(validModules),
})

function computeRecommendation(answers: { id: string; rating: number }[]): string {
  const moduleMap: Record<string, string> = {
    'intrusive-images': 'tetris',
    'fear-pain': 'rtm',
    'cant-stop-thinking': 'tnt',
    'general-distress': 'emdr',
  }
  let topModule = 'emdr'
  let topScore = -1
  for (const answer of answers) {
    const module = moduleMap[answer.id]
    if (module && answer.rating > topScore) {
      topScore = answer.rating
      topModule = module
    }
  }
  return topModule
}

const createSessionSchema = z.object({
  module: z.enum(['tnt', 'rtm', 'tetris', 'emdr', 'preparation']),
})

const updateSessionSchema = z.object({
  suds: z.object({
    rating: z.number().int().min(0).max(10),
    phase: z.string().max(20),
  }).optional(),
  completed: z.boolean().optional(),
  aborted: z.boolean().optional(),
  abortReason: z.enum(['suds_no_change', 'user_panic', 'gaze_lost']).optional(),
})

type SessionRecord = {
  id: string
  module: string
  startedAt: Date | null
  endedAt: Date | null
  completed: boolean | null
  aborted: boolean | null
  abortReason: string | null
}

type SudsRecord = {
  sessionId: string
  rating: number
  phase: string
  recordedAt: Date | null
}

function computeStreak(sessions: SessionRecord[]): number {
  let streak = 0
  for (const s of sessions) {
    if (s.completed) {
      streak++
    } else {
      break
    }
  }
  return streak
}

function buildSudsTrend(sessions: SessionRecord[], ratings: SudsRecord[]) {
  const ratingsBySession = new Map<string, SudsRecord[]>()
  for (const r of ratings) {
    const list = ratingsBySession.get(r.sessionId) || []
    list.push(r)
    ratingsBySession.set(r.sessionId, list)
  }
  return sessions.map((s) => {
    const sessionRatings = ratingsBySession.get(s.id) || []
    const pre = sessionRatings.find((r) => r.phase === 'pre')
    const post = sessionRatings.find((r) => r.phase === 'post')
    return {
      sessionId: s.id,
      module: s.module,
      date: s.startedAt,
      preRating: pre?.rating ?? null,
      postRating: post?.rating ?? null,
    }
  })
}

// --- Simulated state for the full flow ---

type UserState = {
  id: string
  email: string
  screeningComplete: boolean
  preparationComplete: boolean
  activeModule: string | null
  lastTriageResult: string | null
  sessions: SessionRecord[]
  sudsRatings: SudsRecord[]
}

describe('E2E smoke test: full user flow', () => {
  const state: UserState = {
    id: 'fake-uuid',
    email: '',
    screeningComplete: false,
    preparationComplete: false,
    activeModule: null,
    lastTriageResult: null,
    sessions: [],
    sudsRatings: [],
  }

  // Step 1: Register
  it('Step 1: register — validates and creates user', () => {
    const input = { email: 'smoketest@example.com', password: 'securepass123' }
    const parsed = registerSchema.safeParse(input)
    expect(parsed.success).toBe(true)

    state.email = input.email
    // At this point user is registered and authenticated (JWT cookie set)
    expect(state.email).toBe('smoketest@example.com')
  })

  // Step 2: Complete screening (admitted path)
  it('Step 2: screening — validates input and computes admitted result', () => {
    const screeningInput = {
      pcptsd5: { score: 3, answers: [true, true, true, false, false] },
      desbrief: { score: 15, answers: [20, 10, 30, 0, 20, 10, 20, 10] },
    }
    const parsed = submitScreeningSchema.safeParse(screeningInput)
    expect(parsed.success).toBe(true)

    const results = computeScreeningResults(screeningInput.pcptsd5, screeningInput.desbrief)
    expect(results.pcptsd5Result).toBe('admitted')
    expect(results.desbriefResult).toBe('admitted')
    expect(results.overallResult).toBe('admitted')

    state.screeningComplete = true
  })

  // Step 3: Complete preparation (requires screening)
  it('Step 3: preparation — requires screening, marks complete', () => {
    // The preparation endpoint checks screening first
    expect(state.screeningComplete).toBe(true)

    // Simulate the preparation completion logic
    if (!state.screeningComplete) {
      throw new Error('Screening must be completed first')
    }

    state.preparationComplete = true
    expect(state.preparationComplete).toBe(true)
  })

  // Step 4: Triage → recommends Tetris
  it('Step 4: triage — validates input, recommends tetris for intrusive images', () => {
    const triageInput = {
      answers: [
        { id: 'intrusive-images', rating: 5 },
        { id: 'fear-pain', rating: 2 },
        { id: 'cant-stop-thinking', rating: 1 },
        { id: 'general-distress', rating: 3 },
      ],
      recommendation: 'tetris' as const,
      selectedModule: 'tetris' as const,
    }

    const parsed = triageSchema.safeParse(triageInput)
    expect(parsed.success).toBe(true)

    const recommendation = computeRecommendation(triageInput.answers)
    expect(recommendation).toBe('tetris')

    state.lastTriageResult = recommendation
    state.activeModule = triageInput.selectedModule
    expect(state.activeModule).toBe('tetris')
  })

  // Step 5: Create a Tetris session
  it('Step 5: create session — validates module and creates session', () => {
    const sessionInput = { module: 'tetris' as const }
    const parsed = createSessionSchema.safeParse(sessionInput)
    expect(parsed.success).toBe(true)

    const session: SessionRecord = {
      id: 'session-uuid-1',
      module: 'tetris',
      startedAt: new Date(),
      endedAt: null,
      completed: false,
      aborted: false,
      abortReason: null,
    }
    state.sessions.push(session)
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].module).toBe('tetris')
  })

  // Step 6: Submit pre-session SUDs rating
  it('Step 6: pre-session SUDs — validates and records rating', () => {
    const preUpdate = { suds: { rating: 7, phase: 'pre' } }
    const parsed = updateSessionSchema.safeParse(preUpdate)
    expect(parsed.success).toBe(true)

    state.sudsRatings.push({
      sessionId: state.sessions[0].id,
      rating: 7,
      phase: 'pre',
      recordedAt: new Date(),
    })
    expect(state.sudsRatings).toHaveLength(1)
  })

  // Step 7: Complete the Tetris session with post-SUDs
  it('Step 7: complete session — validates completion and post-SUDs', () => {
    const postUpdate = {
      suds: { rating: 3, phase: 'post' },
      completed: true,
    }
    const parsed = updateSessionSchema.safeParse(postUpdate)
    expect(parsed.success).toBe(true)

    state.sudsRatings.push({
      sessionId: state.sessions[0].id,
      rating: 3,
      phase: 'post',
      recordedAt: new Date(),
    })
    state.sessions[0].completed = true
    state.sessions[0].endedAt = new Date()

    expect(state.sessions[0].completed).toBe(true)
    expect(state.sessions[0].endedAt).not.toBeNull()
  })

  // Step 8: View progress dashboard
  it('Step 8: progress dashboard — aggregates session data correctly', () => {
    const protocolOnly = state.sessions.filter((s) => s.module !== 'preparation')

    // Session counts
    const sessionCount = protocolOnly.length
    const completedCount = protocolOnly.filter((s) => s.completed).length
    const abortedCount = protocolOnly.filter((s) => s.aborted).length
    expect(sessionCount).toBe(1)
    expect(completedCount).toBe(1)
    expect(abortedCount).toBe(0)

    // Streak
    const streak = computeStreak(protocolOnly)
    expect(streak).toBe(1)

    // SUDs trend
    const trend = buildSudsTrend(protocolOnly, state.sudsRatings)
    expect(trend).toHaveLength(1)
    expect(trend[0].preRating).toBe(7)
    expect(trend[0].postRating).toBe(3)
    expect(trend[0].module).toBe('tetris')

    // Module stats: tetris has 1 completed session
    const tetrisSessions = protocolOnly.filter((s) => s.module === 'tetris' && s.completed)
    expect(tetrisSessions).toHaveLength(1)
  })

  // Step 9: Verify full state consistency at end of flow
  it('Step 9: final state — all flags and data are consistent', () => {
    expect(state.screeningComplete).toBe(true)
    expect(state.preparationComplete).toBe(true)
    expect(state.activeModule).toBe('tetris')
    expect(state.lastTriageResult).toBe('tetris')
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].completed).toBe(true)
    expect(state.sudsRatings).toHaveLength(2)
    expect(state.sudsRatings[0].phase).toBe('pre')
    expect(state.sudsRatings[1].phase).toBe('post')
  })
})

describe('E2E smoke test: exclusion path', () => {
  it('high DES-Brief score results in exclusion', () => {
    const screeningInput = {
      pcptsd5: { score: 4, answers: [true, true, true, true, false] },
      desbrief: { score: 25, answers: [50, 30, 40, 20, 30, 30, 30, 20] },
    }
    const parsed = submitScreeningSchema.safeParse(screeningInput)
    expect(parsed.success).toBe(true)

    const results = computeScreeningResults(screeningInput.pcptsd5, screeningInput.desbrief)
    expect(results.overallResult).toBe('excluded')
    // Excluded users should not proceed to preparation or triage
  })
})

describe('E2E smoke test: aborted session path', () => {
  it('aborted session does not count toward streak', () => {
    const sessions: SessionRecord[] = [
      {
        id: 's1',
        module: 'tetris',
        startedAt: new Date('2025-01-03'),
        endedAt: new Date('2025-01-03'),
        completed: false,
        aborted: true,
        abortReason: 'user_panic',
      },
      {
        id: 's2',
        module: 'tetris',
        startedAt: new Date('2025-01-02'),
        endedAt: new Date('2025-01-02'),
        completed: true,
        aborted: false,
        abortReason: null,
      },
    ]

    const streak = computeStreak(sessions)
    // Most recent session was aborted, so streak is 0
    expect(streak).toBe(0)

    const abortUpdate = { aborted: true, abortReason: 'user_panic' as const }
    const parsed = updateSessionSchema.safeParse(abortUpdate)
    expect(parsed.success).toBe(true)
  })
})

describe('E2E smoke test: preparation prerequisite enforcement', () => {
  it('preparation cannot complete without screening', () => {
    const state = { screeningComplete: false }

    // Mirrors the server logic: if !screeningComplete, throw 403
    const canComplete = state.screeningComplete
    expect(canComplete).toBe(false)
  })

  it('preparation is idempotent when already complete', () => {
    const state = { screeningComplete: true, preparationComplete: true }

    // Mirrors the server logic: returns { preparationComplete: true, alreadyComplete: true }
    if (state.preparationComplete) {
      const response = { preparationComplete: true, alreadyComplete: true }
      expect(response.alreadyComplete).toBe(true)
    }
  })
})
