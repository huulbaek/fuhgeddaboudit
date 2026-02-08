import { describe, it, expect, beforeEach } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'http'
import { Socket } from 'net'
import { createRateLimiter, _clearRateLimitStore } from '../../server/utils/rateLimit'

function createMockEvent(ip: string = '127.0.0.1', path: string = '/api/auth/login') {
  const socket = new Socket()
  Object.defineProperty(socket, 'remoteAddress', { value: ip, writable: true })

  const req = new IncomingMessage(socket)
  req.method = 'POST'
  req.url = path
  req.headers = { host: 'localhost' }

  const res = new ServerResponse(req)

  return createEvent(req, res)
}

describe('rate limiter', () => {
  beforeEach(() => {
    _clearRateLimitStore()
  })

  it('allows requests within the limit', () => {
    const check = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
    const event = createMockEvent()

    expect(() => check(event)).not.toThrow()
    expect(() => check(event)).not.toThrow()
    expect(() => check(event)).not.toThrow()
  })

  it('blocks requests exceeding the limit', () => {
    const check = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    const event = createMockEvent()

    check(event) // 1
    check(event) // 2

    // 3rd attempt should throw 429
    try {
      check(event)
      expect.unreachable('should have thrown')
    } catch (err: any) {
      expect(err.statusCode).toBe(429)
    }
  })

  it('tracks different IPs separately', () => {
    const check = createRateLimiter({ maxAttempts: 1, windowMs: 60_000 })

    const event1 = createMockEvent('10.0.0.1')
    const event2 = createMockEvent('10.0.0.2')

    check(event1) // IP1: 1/1
    expect(() => check(event1)).toThrow() // IP1: over limit

    // IP2 should still be fine
    expect(() => check(event2)).not.toThrow()
  })

  it('tracks different paths separately', () => {
    const check = createRateLimiter({ maxAttempts: 1, windowMs: 60_000 })

    const loginEvent = createMockEvent('127.0.0.1', '/api/auth/login')
    const registerEvent = createMockEvent('127.0.0.1', '/api/auth/register')

    check(loginEvent) // login: 1/1
    expect(() => check(loginEvent)).toThrow() // login: over

    // register should still be fine
    expect(() => check(registerEvent)).not.toThrow()
  })

  it('resets after the window expires', () => {
    const check = createRateLimiter({ maxAttempts: 1, windowMs: 1 }) // 1ms window
    const event = createMockEvent()

    check(event) // 1/1

    // Wait for the window to expire
    const start = Date.now()
    while (Date.now() - start < 5) {
      // spin wait ~5ms
    }

    // Should be allowed again after window reset
    expect(() => check(event)).not.toThrow()
  })

  it('uses default values when no options provided', () => {
    const check = createRateLimiter()
    const event = createMockEvent()

    // Should allow at least 5 attempts (default)
    for (let i = 0; i < 5; i++) {
      expect(() => check(event)).not.toThrow()
    }

    // 6th should fail
    expect(() => check(event)).toThrow()
  })
})
