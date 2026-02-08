import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { screeningResults, userStatus } from '../../database/schema'

const submitSchema = z.object({
  pcptsd5: z.object({
    score: z.number().int().min(0).max(5),
    answers: z.array(z.boolean()).length(5),
  }),
  desbrief: z.object({
    score: z.number().int().min(0).max(100),
    answers: z.array(z.number().int().min(0).max(100)).length(8),
  }),
})

export { submitSchema }

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readBody(event)
  const parsed = submitSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0].message })
  }

  const { pcptsd5, desbrief } = parsed.data

  // DES-Brief >= 20 → excluded (dissociation risk)
  // PC-PTSD-5 >= 3 → admitted
  // Below threshold → informational
  const desbriefResult = desbrief.score >= 20 ? 'excluded' : 'admitted'
  const pcptsd5Result = pcptsd5.score >= 3 ? 'admitted' : 'informational'

  // If DES-Brief excludes, overall result is excluded regardless of PC-PTSD-5
  const overallResult = desbriefResult === 'excluded' ? 'excluded' : pcptsd5Result

  // Save both screening results
  await db.insert(screeningResults).values([
    {
      userId,
      instrument: 'PC-PTSD-5',
      score: pcptsd5.score,
      result: pcptsd5Result,
    },
    {
      userId,
      instrument: 'DES-Brief',
      score: desbrief.score,
      result: desbriefResult,
    },
  ])

  // Update user status
  await db
    .update(userStatus)
    .set({ screeningComplete: true, updatedAt: new Date() })
    .where(eq(userStatus.userId, userId))

  return {
    pcptsd5: { score: pcptsd5.score, result: pcptsd5Result },
    desbrief: { score: desbrief.score, result: desbriefResult },
    overallResult,
  }
})
