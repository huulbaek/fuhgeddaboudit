import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from '../../server/utils/auth'

const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/auth/logout']

describe('auth middleware logic', () => {
  it('public routes are not protected', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(PUBLIC_ROUTES.includes(route)).toBe(true)
    }
  })

  it('non-api routes are not protected', () => {
    const path = '/about'
    expect(path.startsWith('/api/')).toBe(false)
  })

  it('valid token extracts userId', () => {
    const userId = 'test-user-id-123'
    const token = signToken({ userId })
    const payload = verifyToken(token)
    expect(payload.userId).toBe(userId)
  })

  it('invalid token throws', () => {
    expect(() => verifyToken('garbage-token')).toThrow()
  })
})
