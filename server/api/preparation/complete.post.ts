import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { userStatus } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string

  const [status] = await db
    .select({
      screeningComplete: userStatus.screeningComplete,
      preparationComplete: userStatus.preparationComplete,
    })
    .from(userStatus)
    .where(eq(userStatus.userId, userId))

  if (!status) {
    throw createError({ statusCode: 404, statusMessage: 'User status not found' })
  }

  if (!status.screeningComplete) {
    throw createError({ statusCode: 403, statusMessage: 'Screening must be completed first' })
  }

  if (status.preparationComplete) {
    return { preparationComplete: true, alreadyComplete: true }
  }

  await db
    .update(userStatus)
    .set({ preparationComplete: true, updatedAt: new Date() })
    .where(eq(userStatus.userId, userId))

  return { preparationComplete: true }
})
