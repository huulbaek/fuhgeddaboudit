import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Mirror the schema and logic from server/api/triage/recommend.post.ts
// (server files use Nitro auto-imports not available in unit tests)

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

function computeRecommendation(answers: { id: string; rating: number }[]): string {
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

describe('triage recommend endpoint', () => {
  describe('computeRecommendation', () => {
    it('recommends tetris when intrusive-images is highest', () => {
      const answers = [
        { id: 'intrusive-images', rating: 5 },
        { id: 'fear-pain', rating: 2 },
        { id: 'cant-stop-thinking', rating: 1 },
        { id: 'general-distress', rating: 3 },
      ]
      expect(computeRecommendation(answers)).toBe('tetris')
    })

    it('recommends rtm when fear-pain is highest', () => {
      const answers = [
        { id: 'intrusive-images', rating: 1 },
        { id: 'fear-pain', rating: 5 },
        { id: 'cant-stop-thinking', rating: 2 },
        { id: 'general-distress', rating: 1 },
      ]
      expect(computeRecommendation(answers)).toBe('rtm')
    })

    it('recommends tnt when cant-stop-thinking is highest', () => {
      const answers = [
        { id: 'intrusive-images', rating: 1 },
        { id: 'fear-pain', rating: 2 },
        { id: 'cant-stop-thinking', rating: 5 },
        { id: 'general-distress', rating: 1 },
      ]
      expect(computeRecommendation(answers)).toBe('tnt')
    })

    it('recommends emdr when general-distress is highest', () => {
      const answers = [
        { id: 'intrusive-images', rating: 1 },
        { id: 'fear-pain', rating: 2 },
        { id: 'cant-stop-thinking', rating: 1 },
        { id: 'general-distress', rating: 5 },
      ]
      expect(computeRecommendation(answers)).toBe('emdr')
    })

    it('picks first highest when scores tie', () => {
      const answers = [
        { id: 'intrusive-images', rating: 3 },
        { id: 'fear-pain', rating: 3 },
        { id: 'cant-stop-thinking', rating: 3 },
        { id: 'general-distress', rating: 3 },
      ]
      expect(computeRecommendation(answers)).toBe('tetris')
    })

    it('defaults to emdr when no known question ids', () => {
      const answers = [
        { id: 'unknown-question', rating: 5 },
      ]
      expect(computeRecommendation(answers)).toBe('emdr')
    })

    it('defaults to emdr for empty answers', () => {
      expect(computeRecommendation([])).toBe('emdr')
    })
  })

  describe('triageSchema validation', () => {
    const validBody = {
      answers: [
        { id: 'intrusive-images', rating: 5 },
        { id: 'fear-pain', rating: 2 },
        { id: 'cant-stop-thinking', rating: 1 },
        { id: 'general-distress', rating: 3 },
      ],
      recommendation: 'tetris',
      selectedModule: 'tetris',
    }

    it('accepts valid triage input', () => {
      const result = triageSchema.safeParse(validBody)
      expect(result.success).toBe(true)
    })

    it('rejects invalid module name', () => {
      const result = triageSchema.safeParse({
        ...validBody,
        selectedModule: 'invalid',
      })
      expect(result.success).toBe(false)
    })

    it('rejects rating out of range (0)', () => {
      const result = triageSchema.safeParse({
        ...validBody,
        answers: [{ id: 'intrusive-images', rating: 0 }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects rating out of range (6)', () => {
      const result = triageSchema.safeParse({
        ...validBody,
        answers: [{ id: 'intrusive-images', rating: 6 }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects empty answers array', () => {
      const result = triageSchema.safeParse({
        ...validBody,
        answers: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects missing recommendation', () => {
      const { recommendation, ...rest } = validBody
      const result = triageSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('rejects missing selectedModule', () => {
      const { selectedModule, ...rest } = validBody
      const result = triageSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('allows user to select a different module than recommendation', () => {
      const result = triageSchema.safeParse({
        ...validBody,
        recommendation: 'tetris',
        selectedModule: 'emdr',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.selectedModule).toBe('emdr')
      }
    })
  })
})
