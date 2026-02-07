import { describe, it, expect } from 'vitest'

// Test the business logic of the preparation complete endpoint
// (validation rules and state transitions)

describe('preparation complete endpoint logic', () => {
  function evaluateRequest(status: { screeningComplete: boolean | null; preparationComplete: boolean | null } | null) {
    if (!status) {
      return { error: 404, message: 'User status not found' }
    }
    if (!status.screeningComplete) {
      return { error: 403, message: 'Screening must be completed first' }
    }
    if (status.preparationComplete) {
      return { result: { preparationComplete: true, alreadyComplete: true } }
    }
    return { result: { preparationComplete: true } }
  }

  it('returns 404 when user status does not exist', () => {
    const result = evaluateRequest(null)
    expect(result.error).toBe(404)
    expect(result.message).toContain('User status not found')
  })

  it('returns 403 when screening is not complete', () => {
    const result = evaluateRequest({ screeningComplete: false, preparationComplete: false })
    expect(result.error).toBe(403)
    expect(result.message).toContain('Screening must be completed first')
  })

  it('returns already complete when preparation was already done', () => {
    const result = evaluateRequest({ screeningComplete: true, preparationComplete: true })
    expect(result).toEqual({ result: { preparationComplete: true, alreadyComplete: true } })
  })

  it('marks preparation complete when screening is done', () => {
    const result = evaluateRequest({ screeningComplete: true, preparationComplete: false })
    expect(result).toEqual({ result: { preparationComplete: true } })
  })

  it('requires screening even if preparation is somehow flagged', () => {
    // Edge case: screeningComplete is null/false but preparationComplete is true
    const result = evaluateRequest({ screeningComplete: false, preparationComplete: true })
    expect(result.error).toBe(403)
  })
})
