import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

describe('register validation', () => {
  it('accepts a valid email and password', () => {
    const result = registerSchema.safeParse({ email: 'user@example.com', password: 'securepass123' })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({ email: 'not-an-email', password: 'securepass123' })
    expect(result.success).toBe(false)
  })

  it('rejects a short password', () => {
    const result = registerSchema.safeParse({ email: 'user@example.com', password: 'short' })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(registerSchema.safeParse({}).success).toBe(false)
    expect(registerSchema.safeParse({ email: 'user@example.com' }).success).toBe(false)
    expect(registerSchema.safeParse({ password: 'securepass123' }).success).toBe(false)
  })
})
