import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { users } from '../../database/schema'
import { verifyToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'auth_token')
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  let payload: { userId: string }
  try {
    payload = verifyToken(token)
  } catch {
    deleteCookie(event, 'auth_token', { path: '/' })
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' })
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, payload.userId))

  if (!user) {
    deleteCookie(event, 'auth_token', { path: '/' })
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  return { id: user.id, email: user.email }
})
