import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  assertJwtSecretConfigured,
} from '../../server/utils/auth'

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

describe('JWT secret in production', () => {
  // The development fallback is published with the source, so a production
  // server that used it would accept tokens forged by anyone.
  const PUBLIC_DEV_SECRET = 'dev-secret-change-in-production'

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses to sign when JWT_SECRET is unset', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', undefined)

    expect(() => signToken({ userId: 'u1' })).toThrow(/JWT_SECRET/)
  })

  it('refuses to sign when JWT_SECRET is blank, as an unset compose variable is', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', '   ')

    expect(() => signToken({ userId: 'u1' })).toThrow(/JWT_SECRET/)
  })

  it('refuses to sign with the published development secret', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', PUBLIC_DEV_SECRET)

    expect(() => signToken({ userId: 'u1' })).toThrow(/JWT_SECRET/)
  })

  it('refuses to verify when JWT_SECRET is unset, even a token signed with the development secret', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('JWT_SECRET', undefined)
    const forged = signToken({ userId: 'attacker' })

    vi.stubEnv('NODE_ENV', 'production')

    expect(() => verifyToken(forged)).toThrow(/JWT_SECRET/)
  })

  it('signs and verifies with the configured secret', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', 'a-private-production-secret')

    const token = signToken({ userId: 'u1' })

    expect(verifyToken(token).userId).toBe('u1')
  })

  it('rejects a token signed with the development secret once a real secret is configured', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('JWT_SECRET', undefined)
    const forged = signToken({ userId: 'attacker' })

    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', 'a-private-production-secret')

    expect(() => verifyToken(forged)).toThrow(/invalid signature/)
  })

  it('reports a missing secret at startup rather than at first login', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', undefined)

    expect(() => assertJwtSecretConfigured()).toThrow(/JWT_SECRET/)
  })

  it('starts without a secret outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('JWT_SECRET', undefined)

    expect(() => assertJwtSecretConfigured()).not.toThrow()
  })
})
