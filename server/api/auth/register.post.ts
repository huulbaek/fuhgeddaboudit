import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { users, userStatus } from '../../database/schema'
import { hashPassword, signToken } from '../../utils/auth'
import { createRateLimiter } from '../../utils/rateLimit'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const checkRateLimit = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })

export default defineEventHandler(async (event) => {
  checkRateLimit(event)
  const body = await readBody(event)
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' })
  }

  const { email, password } = parsed.data

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id })

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create account' })
  }

  await db.insert(userStatus).values({ userId: user.id })

  const token = signToken({ userId: user.id })
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return { id: user.id, email }
})
