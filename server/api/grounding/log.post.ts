import { z } from 'zod'
import { db } from '../../database/drizzle'
import { groundingEvents } from '../../database/schema'

const logSchema = z.object({
  context: z.string().max(50).optional(),
  sessionId: z.string().uuid().optional(),
  durationSecs: z.number().int().min(0).optional(),
})

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readBody(event)
  const parsed = logSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const [entry] = await db
    .insert(groundingEvents)
    .values({
      userId,
      sessionId: parsed.data.sessionId || null,
      context: parsed.data.context || null,
      durationSecs: parsed.data.durationSecs || null,
    })
    .returning({ id: groundingEvents.id })

  if (!entry) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to log grounding event' })
  }

  return { id: entry.id }
})
