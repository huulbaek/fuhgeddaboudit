import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { protocolSessions, sudsRatings } from '../../database/schema'

const paramsSchema = z.object({
  id: z.string().uuid('Invalid session ID format'),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const parsed = paramsSchema.safeParse({ id: getRouterParam(event, 'id') })

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const sessionId = parsed.data.id

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
