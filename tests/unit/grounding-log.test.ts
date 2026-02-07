import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const logSchema = z.object({
  context: z.string().max(50).optional(),
  sessionId: z.string().uuid().optional(),
  durationSecs: z.number().int().min(0).optional(),
})

describe('grounding log validation', () => {
  it('accepts a valid grounding log', () => {
    const result = logSchema.safeParse({ context: 'rtm-session', durationSecs: 30 })
    expect(result.success).toBe(true)
  })

  it('accepts empty body', () => {
    expect(logSchema.safeParse({}).success).toBe(true)
  })

  it('rejects an invalid sessionId', () => {
    const result = logSchema.safeParse({ sessionId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects negative duration', () => {
    const result = logSchema.safeParse({ durationSecs: -5 })
    expect(result.success).toBe(false)
  })
})
