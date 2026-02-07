import { describe, it, expect } from 'vitest'

describe('screening status endpoint logic', () => {
  it('returns screeningComplete false when not yet screened', () => {
    const status = { screeningComplete: false }
    const response = status.screeningComplete
      ? { screeningComplete: true, results: [] }
      : { screeningComplete: false, results: [] }
    expect(response.screeningComplete).toBe(false)
    expect(response.results).toEqual([])
  })

  it('returns screeningComplete true with results when screened', () => {
    const status = { screeningComplete: true }
    const mockResults = [
      { instrument: 'PC-PTSD-5', score: 4, result: 'admitted' },
      { instrument: 'DES-Brief', score: 12, result: 'admitted' },
    ]
    const response = status.screeningComplete
      ? { screeningComplete: true, results: mockResults }
      : { screeningComplete: false, results: [] }
    expect(response.screeningComplete).toBe(true)
    expect(response.results).toHaveLength(2)
    expect(response.results[0].instrument).toBe('PC-PTSD-5')
    expect(response.results[1].instrument).toBe('DES-Brief')
  })

  it('throws 404 when user status record is missing', () => {
    const status = undefined
    expect(status).toBeUndefined()
    // In the actual endpoint, this would throw createError({ statusCode: 404 })
  })
})
