import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../../../database/drizzle'
import { protocolSessions, tntSessionData } from '../../../database/schema'

export const tntDataSchema = z.object({
  totalTrials: z.number().int().min(0),
  thinkTrials: z.number().int().min(0),
  noThinkTrials: z.number().int().min(0),
  compliancePct: z.number().min(0).max(100),
  avgReactionTimeMs: z.number().int().min(0).nullable(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const sessionId = getRouterParam(event, 'id')

  if (!sessionId) {
    throw createError({ statusCode: 400, statusMessage: 'Session ID is required' })
  }

  const body = await readBody(event)
  const parsed = tntDataSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0].message })
  }

  // Verify session exists, belongs to user, and is a TNT session
  const [session] = await db
    .select({ id: protocolSessions.id, module: protocolSessions.module })
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

  if (session.module !== 'tnt') {
    throw createError({ statusCode: 400, statusMessage: 'Session is not a TNT session' })
  }

  const [row] = await db
    .insert(tntSessionData)
    .values({
      sessionId,
      totalTrials: parsed.data.totalTrials,
      thinkTrials: parsed.data.thinkTrials,
      noThinkTrials: parsed.data.noThinkTrials,
      gazeCompliancePct: String(parsed.data.compliancePct),
      avgReactionTimeMs: parsed.data.avgReactionTimeMs,
    })
    .returning({ id: tntSessionData.id })

  return { id: row.id, saved: true }
})
