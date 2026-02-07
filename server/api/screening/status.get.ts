import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { userStatus, screeningResults } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string

  const [status] = await db
    .select({ screeningComplete: userStatus.screeningComplete })
    .from(userStatus)
    .where(eq(userStatus.userId, userId))

  if (!status) {
    throw createError({ statusCode: 404, statusMessage: 'User status not found' })
  }

  // If screening is complete, also return the results
  if (status.screeningComplete) {
    const results = await db
      .select({
        instrument: screeningResults.instrument,
        score: screeningResults.score,
        result: screeningResults.result,
        completedAt: screeningResults.completedAt,
      })
      .from(screeningResults)
      .where(eq(screeningResults.userId, userId))

    return {
      screeningComplete: true,
      results,
    }
  }

  return {
    screeningComplete: false,
    results: [],
  }
})
