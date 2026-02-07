import { eq, and } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { protocolSessions, sudsRatings } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const sessionId = getRouterParam(event, 'id')

  if (!sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'Session ID is required' })
  }

  const [session] = await db
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
    .where(
      and(
        eq(protocolSessions.id, sessionId),
        eq(protocolSessions.userId, userId),
      ),
    )

  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found' })
  }

  const ratings = await db
    .select({
      id: sudsRatings.id,
      rating: sudsRatings.rating,
      phase: sudsRatings.phase,
      recordedAt: sudsRatings.recordedAt,
    })
    .from(sudsRatings)
    .where(eq(sudsRatings.sessionId, sessionId))

  return { ...session, sudsRatings: ratings }
})
