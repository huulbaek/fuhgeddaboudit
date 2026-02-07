import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { users, userStatus } from '../../database/schema'
import { hashPassword, signToken } from '../../utils/auth'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0].message })
  }

  const { email, password } = parsed.data

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Email already registered' })
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db.insert(users).values({ email, passwordHash }).returning({ id: users.id })

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
