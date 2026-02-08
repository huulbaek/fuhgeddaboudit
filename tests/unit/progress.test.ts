import { describe, it, expect } from 'vitest'

// Mirror types and logic from server/api/progress/index.get.ts
// (Nitro auto-imports are not available in unit tests)

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

type TntRecord = {
  sessionId: string
  gazeCompliancePct: string | null
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

function buildSudsTrend(
  sessions: SessionRecord[],
  ratings: SudsRecord[],
): { sessionId: string; module: string; date: Date | null; preRating: number | null; postRating: number | null }[] {
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

function computeModuleStats(
  sessions: SessionRecord[],
  ratings: SudsRecord[],
  tntData: TntRecord[],
) {
  const modules = ['tetris', 'rtm', 'tnt', 'emdr'] as const
  const stats: Record<string, { completedSessions: number; [key: string]: unknown }> = {}

  for (const mod of modules) {
    const modSessions = sessions.filter((s) => s.module === mod && s.completed)
    if (modSessions.length === 0) continue

    if (mod === 'tnt') {
      const complianceValues = tntData
        .filter((t) => modSessions.some((s) => s.id === t.sessionId) && t.gazeCompliancePct !== null)
        .map((t) => parseFloat(t.gazeCompliancePct!))
      const avgCompliance = complianceValues.length > 0
        ? complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length
        : null
      stats.tnt = { completedSessions: modSessions.length, avgCompliancePct: avgCompliance }
    } else if (mod === 'rtm') {
      const ratingsBySession = new Map<string, SudsRecord[]>()
      for (const r of ratings) {
        const list = ratingsBySession.get(r.sessionId) || []
        list.push(r)
        ratingsBySession.set(r.sessionId, list)
      }
      const loopCounts: number[] = []
      for (const s of modSessions) {
        const sessionRatings = (ratingsBySession.get(s.id) || [])
          .filter((r) => r.phase.startsWith('mid_loop') || r.phase === 'post')
          .sort((a, b) => (a.recordedAt?.getTime() ?? 0) - (b.recordedAt?.getTime() ?? 0))
        let loops = sessionRatings.length
        for (let i = 0; i < sessionRatings.length; i++) {
          if (sessionRatings[i].rating <= 3) {
            loops = i + 1
            break
          }
        }
        loopCounts.push(loops)
      }
      const avgLoops = loopCounts.length > 0
        ? loopCounts.reduce((a, b) => a + b, 0) / loopCounts.length
        : null
      stats.rtm = { completedSessions: modSessions.length, avgLoopsToTarget: avgLoops }
    } else if (mod === 'tetris') {
      stats.tetris = { completedSessions: modSessions.length }
    } else if (mod === 'emdr') {
      stats.emdr = { completedSessions: modSessions.length }
    }
  }

  return stats
}

// Helper to create mock sessions
function mockSession(overrides: Partial<SessionRecord> & { id: string; module: string }): SessionRecord {
  return {
    startedAt: new Date('2026-01-01'),
    endedAt: null,
    completed: false,
    aborted: false,
    abortReason: null,
    ...overrides,
  }
}

describe('progress endpoint', () => {
  describe('computeStreak', () => {
    it('returns 0 for empty sessions', () => {
      expect(computeStreak([])).toBe(0)
    })

    it('counts consecutive completed sessions from the start', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tetris', completed: true }),
        mockSession({ id: '2', module: 'rtm', completed: true }),
        mockSession({ id: '3', module: 'tnt', completed: false }),
        mockSession({ id: '4', module: 'emdr', completed: true }),
      ]
      expect(computeStreak(sessions)).toBe(2)
    })

    it('returns 0 when first session is not completed', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tetris', completed: false }),
        mockSession({ id: '2', module: 'rtm', completed: true }),
      ]
      expect(computeStreak(sessions)).toBe(0)
    })

    it('returns full count when all sessions completed', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tetris', completed: true }),
        mockSession({ id: '2', module: 'rtm', completed: true }),
        mockSession({ id: '3', module: 'tnt', completed: true }),
      ]
      expect(computeStreak(sessions)).toBe(3)
    })
  })

  describe('buildSudsTrend', () => {
    it('returns empty array for no sessions', () => {
      expect(buildSudsTrend([], [])).toEqual([])
    })

    it('maps pre and post ratings to sessions', () => {
      const sessions = [
        mockSession({ id: 's1', module: 'tetris' }),
      ]
      const ratings: SudsRecord[] = [
        { sessionId: 's1', rating: 7, phase: 'pre', recordedAt: new Date() },
        { sessionId: 's1', rating: 3, phase: 'post', recordedAt: new Date() },
      ]
      const trend = buildSudsTrend(sessions, ratings)
      expect(trend).toHaveLength(1)
      expect(trend[0].preRating).toBe(7)
      expect(trend[0].postRating).toBe(3)
    })

    it('returns null ratings when no matching SUDs data', () => {
      const sessions = [
        mockSession({ id: 's1', module: 'rtm' }),
      ]
      const trend = buildSudsTrend(sessions, [])
      expect(trend[0].preRating).toBeNull()
      expect(trend[0].postRating).toBeNull()
    })

    it('handles sessions with only pre rating', () => {
      const sessions = [
        mockSession({ id: 's1', module: 'emdr' }),
      ]
      const ratings: SudsRecord[] = [
        { sessionId: 's1', rating: 6, phase: 'pre', recordedAt: new Date() },
      ]
      const trend = buildSudsTrend(sessions, ratings)
      expect(trend[0].preRating).toBe(6)
      expect(trend[0].postRating).toBeNull()
    })
  })

  describe('computeModuleStats', () => {
    it('returns empty stats when no sessions', () => {
      expect(computeModuleStats([], [], [])).toEqual({})
    })

    it('skips modules with no completed sessions', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tetris', completed: false }),
      ]
      const stats = computeModuleStats(sessions, [], [])
      expect(stats.tetris).toBeUndefined()
    })

    it('computes tetris stats', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tetris', completed: true }),
        mockSession({ id: '2', module: 'tetris', completed: true }),
      ]
      const stats = computeModuleStats(sessions, [], [])
      expect(stats.tetris).toEqual({ completedSessions: 2 })
    })

    it('computes TNT compliance average', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tnt', completed: true }),
        mockSession({ id: '2', module: 'tnt', completed: true }),
      ]
      const tntData: TntRecord[] = [
        { sessionId: '1', gazeCompliancePct: '80.5' },
        { sessionId: '2', gazeCompliancePct: '90.5' },
      ]
      const stats = computeModuleStats(sessions, [], tntData)
      expect(stats.tnt).toBeDefined()
      expect(stats.tnt!.completedSessions).toBe(2)
      expect(stats.tnt!.avgCompliancePct).toBeCloseTo(85.5)
    })

    it('handles TNT with null compliance', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tnt', completed: true }),
      ]
      const tntData: TntRecord[] = [
        { sessionId: '1', gazeCompliancePct: null },
      ]
      const stats = computeModuleStats(sessions, [], tntData)
      expect(stats.tnt!.avgCompliancePct).toBeNull()
    })

    it('computes RTM avg loops to target SUDs ≤ 3', () => {
      const sessions = [
        mockSession({ id: '1', module: 'rtm', completed: true }),
      ]
      const ratings: SudsRecord[] = [
        { sessionId: '1', rating: 7, phase: 'mid_loop_1', recordedAt: new Date('2026-01-01T00:01:00') },
        { sessionId: '1', rating: 5, phase: 'mid_loop_2', recordedAt: new Date('2026-01-01T00:02:00') },
        { sessionId: '1', rating: 3, phase: 'mid_loop_3', recordedAt: new Date('2026-01-01T00:03:00') },
      ]
      const stats = computeModuleStats(sessions, ratings, [])
      expect(stats.rtm!.completedSessions).toBe(1)
      expect(stats.rtm!.avgLoopsToTarget).toBe(3)
    })

    it('computes RTM loops when SUDs never reaches target', () => {
      const sessions = [
        mockSession({ id: '1', module: 'rtm', completed: true }),
      ]
      const ratings: SudsRecord[] = [
        { sessionId: '1', rating: 7, phase: 'mid_loop_1', recordedAt: new Date('2026-01-01T00:01:00') },
        { sessionId: '1', rating: 5, phase: 'mid_loop_2', recordedAt: new Date('2026-01-01T00:02:00') },
      ]
      const stats = computeModuleStats(sessions, ratings, [])
      // When SUDs never reaches ≤ 3, loops = total rating count
      expect(stats.rtm!.avgLoopsToTarget).toBe(2)
    })

    it('averages RTM loops across multiple sessions', () => {
      const sessions = [
        mockSession({ id: '1', module: 'rtm', completed: true }),
        mockSession({ id: '2', module: 'rtm', completed: true }),
      ]
      const ratings: SudsRecord[] = [
        // Session 1: reaches target at loop 2
        { sessionId: '1', rating: 5, phase: 'mid_loop_1', recordedAt: new Date('2026-01-01T00:01:00') },
        { sessionId: '1', rating: 2, phase: 'mid_loop_2', recordedAt: new Date('2026-01-01T00:02:00') },
        // Session 2: reaches target at loop 4
        { sessionId: '2', rating: 8, phase: 'mid_loop_1', recordedAt: new Date('2026-01-02T00:01:00') },
        { sessionId: '2', rating: 6, phase: 'mid_loop_2', recordedAt: new Date('2026-01-02T00:02:00') },
        { sessionId: '2', rating: 4, phase: 'mid_loop_3', recordedAt: new Date('2026-01-02T00:03:00') },
        { sessionId: '2', rating: 3, phase: 'post', recordedAt: new Date('2026-01-02T00:04:00') },
      ]
      const stats = computeModuleStats(sessions, ratings, [])
      // Session 1: 2 loops, Session 2: 4 loops → avg = 3
      expect(stats.rtm!.avgLoopsToTarget).toBe(3)
    })

    it('computes emdr stats', () => {
      const sessions = [
        mockSession({ id: '1', module: 'emdr', completed: true }),
      ]
      const stats = computeModuleStats(sessions, [], [])
      expect(stats.emdr).toEqual({ completedSessions: 1 })
    })

    it('computes stats for multiple modules simultaneously', () => {
      const sessions = [
        mockSession({ id: '1', module: 'tetris', completed: true }),
        mockSession({ id: '2', module: 'tnt', completed: true }),
        mockSession({ id: '3', module: 'rtm', completed: false }),
      ]
      const tntData: TntRecord[] = [
        { sessionId: '2', gazeCompliancePct: '95.0' },
      ]
      const stats = computeModuleStats(sessions, [], tntData)
      expect(stats.tetris).toBeDefined()
      expect(stats.tnt).toBeDefined()
      expect(stats.rtm).toBeUndefined() // not completed
    })
  })

  describe('preparation session filtering', () => {
    it('preparation sessions should be excluded from protocol-only list', () => {
      const allSessions = [
        mockSession({ id: '1', module: 'preparation', completed: true }),
        mockSession({ id: '2', module: 'tetris', completed: true }),
        mockSession({ id: '3', module: 'rtm', completed: true }),
      ]
      const protocolOnly = allSessions.filter((s) => s.module !== 'preparation')
      expect(protocolOnly).toHaveLength(2)
      expect(protocolOnly.every((s) => s.module !== 'preparation')).toBe(true)
    })
  })
})
