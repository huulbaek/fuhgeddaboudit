import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { protocolSessions, sudsRatings } from '../../database/schema'

export const updateSessionSchema = z.object({
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

const paramsSchema = z.object({
  id: z.string().uuid('Invalid session ID format'),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const paramsParsed = paramsSchema.safeParse({ id: getRouterParam(event, 'id') })

  if (!paramsParsed.success) {
    throw createError({ statusCode: 400, statusMessage: paramsParsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const sessionId = paramsParsed.data.id

  const body = await readBody(event)
  const parsed = updateSessionSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  // Verify session exists and belongs to user
  const [session] = await db
    .select({ id: protocolSessions.id })
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

  const { suds, completed, aborted, abortReason } = parsed.data

  // Insert SUDs rating if provided
  if (suds) {
    await db.insert(sudsRatings).values({
      sessionId,
      rating: suds.rating,
      phase: suds.phase,
    })
  }

  // Update session fields if provided
  const updates: Record<string, unknown> = {}
  if (completed !== undefined) {
    updates.completed = completed
    updates.endedAt = new Date()
  }
  if (aborted !== undefined) {
    updates.aborted = aborted
    updates.endedAt = new Date()
  }
  if (abortReason !== undefined) {
    updates.abortReason = abortReason
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(protocolSessions)
      .set(updates)
      .where(eq(protocolSessions.id, sessionId))
  }

  return { updated: true }
})
