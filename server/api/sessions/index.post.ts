import { z } from 'zod'
import { db } from '../../database/drizzle'
import { protocolSessions } from '../../database/schema'

export const createSessionSchema = z.object({
  module: z.enum(['tnt', 'rtm', 'tetris', 'emdr', 'preparation']),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readBody(event)
  const parsed = createSessionSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const [session] = await db
    .insert(protocolSessions)
    .values({
      userId,
      module: parsed.data.module,
    })
    .returning({
      id: protocolSessions.id,
      module: protocolSessions.module,
      startedAt: protocolSessions.startedAt,
    })

  return session
})
