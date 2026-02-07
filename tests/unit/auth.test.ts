import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, signToken, verifyToken } from '../../server/utils/auth'

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const password = 'test-password-123'
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    expect(await verifyPassword(password, hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-password')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('produces different hashes for the same password', async () => {
    const password = 'same-password'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2)
  })
})

describe('JWT helpers', () => {
  it('signs and verifies a token', () => {
    const payload = { userId: '123e4567-e89b-12d3-a456-426614174000' }
    const token = signToken(payload)
    const decoded = verifyToken(token)

    expect(decoded.userId).toBe(payload.userId)
  })

  it('throws on an invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow()
  })

  it('throws on a tampered token', () => {
    const token = signToken({ userId: 'test-user' })
    const tampered = token.slice(0, -5) + 'XXXXX'
    expect(() => verifyToken(tampered)).toThrow()
  })
})
