import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { userStatus } from '../../database/schema'

const validModules = ['tetris', 'rtm', 'tnt', 'emdr'] as const

const answerSchema = z.object({
  id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
})

const triageSchema = z.object({
  answers: z.array(answerSchema).min(1),
  recommendation: z.enum(validModules),
  selectedModule: z.enum(validModules),
})

export { triageSchema }

export function computeRecommendation(answers: { id: string; rating: number }[]): string {
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

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readBody(event)
  const parsed = triageSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0].message })
  }

  const { answers, selectedModule } = parsed.data

  const serverRecommendation = computeRecommendation(answers)

  await db
    .update(userStatus)
    .set({
      lastTriageResult: serverRecommendation,
      activeModule: selectedModule,
      updatedAt: new Date(),
    })
    .where(eq(userStatus.userId, userId))

  return {
    recommendation: serverRecommendation,
    selectedModule,
  }
})
