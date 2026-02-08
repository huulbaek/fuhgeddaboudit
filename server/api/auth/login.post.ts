import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { users } from '../../database/schema'
import { verifyPassword, signToken } from '../../utils/auth'
import { createRateLimiter } from '../../utils/rateLimit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const checkRateLimit = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })

export default defineEventHandler(async (event) => {
  checkRateLimit(event)
  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0].message })
  }

  const { email, password } = parsed.data

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  const token = signToken({ userId: user.id })
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return { id: user.id, email }
})
