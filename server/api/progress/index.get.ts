import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { protocolSessions, sudsRatings, tntSessionData } from '../../database/schema'

export type SessionRecord = {
  id: string
  module: string
  startedAt: Date | null
  endedAt: Date | null
  completed: boolean | null
  aborted: boolean | null
  abortReason: string | null
}

export type SudsRecord = {
  sessionId: string
  rating: number
  phase: string
  recordedAt: Date | null
}

export type TntRecord = {
  sessionId: string
  gazeCompliancePct: string | null
}

export function computeStreak(sessions: SessionRecord[]): number {
  // Sessions should be sorted by startedAt descending
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

export function buildSudsTrend(
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

export function computeModuleStats(
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
      // For RTM, count how many SUDs ratings exist per session before reaching ≤ 3
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
          if (sessionRatings[i]!.rating <= 3) {
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

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string

  const sessions = await db
    .select({
      id: protocolSessions.id,
      module: protocolSessions.module,
      startedAt: protocolSessions.startedAt,
      endedAt: protocolSessions.endedAt,
      completed: protocolSessions.completed,
      aborted: protocolSessions.aborted,
      abortReason: protocolSessions.abortReason,
    })
    .from(protocolSessions)
    .where(eq(protocolSessions.userId, userId))
    .orderBy(desc(protocolSessions.startedAt))

  // Exclude 'preparation' sessions from progress stats
  const protocolOnly = sessions.filter((s) => s.module !== 'preparation')

  // Get all SUDs ratings for the user's sessions
  const sessionIds = protocolOnly.map((s) => s.id)
  let userRatings: SudsRecord[] = []
  if (sessionIds.length > 0) {
    userRatings = await db
      .select({
        sessionId: sudsRatings.sessionId,
        rating: sudsRatings.rating,
        phase: sudsRatings.phase,
        recordedAt: sudsRatings.recordedAt,
      })
      .from(sudsRatings)
      .where(inArray(sudsRatings.sessionId, sessionIds))
  }

  // Get TNT session data
  let tntData: TntRecord[] = []
  const tntSessionIds = protocolOnly.filter((s) => s.module === 'tnt').map((s) => s.id)
  if (tntSessionIds.length > 0) {
    tntData = await db
      .select({
        sessionId: tntSessionData.sessionId,
        gazeCompliancePct: tntSessionData.gazeCompliancePct,
      })
      .from(tntSessionData)
      .where(inArray(tntSessionData.sessionId, tntSessionIds))
  }

  const sessionCount = protocolOnly.length
  const completedCount = protocolOnly.filter((s) => s.completed).length
  const abortedCount = protocolOnly.filter((s) => s.aborted).length
  const currentStreak = computeStreak(protocolOnly)
  const sudsTrend = buildSudsTrend(protocolOnly, userRatings)
  const moduleStats = computeModuleStats(protocolOnly, userRatings, tntData)

  const sessionHistory = protocolOnly.map((s) => ({
    id: s.id,
    module: s.module,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    completed: s.completed,
    aborted: s.aborted,
    abortReason: s.abortReason,
  }))

  return {
    sessionCount,
    completedCount,
    abortedCount,
    currentStreak,
    sudsTrend,
    sessionHistory,
    moduleStats,
  }
})
