import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const submitSchema = z.object({
  pcptsd5: z.object({
    score: z.number().int().min(0).max(5),
    answers: z.array(z.boolean()).length(5),
  }),
  desbrief: z.object({
    score: z.number().int().min(0).max(80),
    answers: z.array(z.number().int().min(0).max(10)).length(8),
  }),
})

function computeResults(pcptsd5: { score: number }, desbrief: { score: number }) {
  const desbriefResult = desbrief.score >= 20 ? 'excluded' : 'admitted'
  const pcptsd5Result = pcptsd5.score >= 3 ? 'admitted' : 'informational'
  const overallResult = desbriefResult === 'excluded' ? 'excluded' : pcptsd5Result
  return { desbriefResult, pcptsd5Result, overallResult }
}

describe('screening submit validation', () => {
  const validBody = {
    pcptsd5: { score: 3, answers: [true, true, true, false, false] },
    desbrief: { score: 12, answers: [2, 1, 3, 0, 2, 1, 2, 1] },
  }

  it('accepts valid screening data', () => {
    const result = submitSchema.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('rejects missing pcptsd5', () => {
    const result = submitSchema.safeParse({ desbrief: validBody.desbrief })
    expect(result.success).toBe(false)
  })

  it('rejects missing desbrief', () => {
    const result = submitSchema.safeParse({ pcptsd5: validBody.pcptsd5 })
    expect(result.success).toBe(false)
  })

  it('rejects pcptsd5 score > 5', () => {
    const result = submitSchema.safeParse({
      ...validBody,
      pcptsd5: { score: 6, answers: [true, true, true, true, true] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects pcptsd5 score < 0', () => {
    const result = submitSchema.safeParse({
      ...validBody,
      pcptsd5: { score: -1, answers: [false, false, false, false, false] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects pcptsd5 answers with wrong length', () => {
    const result = submitSchema.safeParse({
      ...validBody,
      pcptsd5: { score: 2, answers: [true, true] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects desbrief score > 80', () => {
    const result = submitSchema.safeParse({
      ...validBody,
      desbrief: { score: 81, answers: [10, 10, 10, 10, 10, 10, 10, 10] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects desbrief answers with wrong length', () => {
    const result = submitSchema.safeParse({
      ...validBody,
      desbrief: { score: 5, answers: [1, 2, 3] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects desbrief answer values > 10', () => {
    const result = submitSchema.safeParse({
      ...validBody,
      desbrief: { score: 12, answers: [11, 1, 1, 1, 1, 1, 1, 1] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty body', () => {
    expect(submitSchema.safeParse({}).success).toBe(false)
  })
})

describe('screening result computation', () => {
  it('DES-Brief >= 20 → excluded regardless of PC-PTSD-5', () => {
    const result = computeResults({ score: 5 }, { score: 20 })
    expect(result.desbriefResult).toBe('excluded')
    expect(result.overallResult).toBe('excluded')
  })

  it('DES-Brief >= 20 and PC-PTSD-5 low → still excluded', () => {
    const result = computeResults({ score: 1 }, { score: 25 })
    expect(result.overallResult).toBe('excluded')
  })

  it('DES-Brief < 20 and PC-PTSD-5 >= 3 → admitted', () => {
    const result = computeResults({ score: 3 }, { score: 10 })
    expect(result.pcptsd5Result).toBe('admitted')
    expect(result.desbriefResult).toBe('admitted')
    expect(result.overallResult).toBe('admitted')
  })

  it('DES-Brief < 20 and PC-PTSD-5 < 3 → informational', () => {
    const result = computeResults({ score: 2 }, { score: 10 })
    expect(result.pcptsd5Result).toBe('informational')
    expect(result.overallResult).toBe('informational')
  })

  it('boundary: DES-Brief exactly 19 → not excluded', () => {
    const result = computeResults({ score: 4 }, { score: 19 })
    expect(result.desbriefResult).toBe('admitted')
    expect(result.overallResult).toBe('admitted')
  })

  it('boundary: PC-PTSD-5 exactly 3 → admitted', () => {
    const result = computeResults({ score: 3 }, { score: 5 })
    expect(result.pcptsd5Result).toBe('admitted')
    expect(result.overallResult).toBe('admitted')
  })

  it('boundary: PC-PTSD-5 exactly 2 → informational', () => {
    const result = computeResults({ score: 2 }, { score: 5 })
    expect(result.pcptsd5Result).toBe('informational')
    expect(result.overallResult).toBe('informational')
  })
})
