import { type H3Event, getRequestIP, getRequestURL, setResponseHeader, createError } from 'h3'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_WINDOW_MS = 60_000 // 1 minute

export function createRateLimiter(options?: { maxAttempts?: number; windowMs?: number }) {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS

  return function checkRateLimit(event: H3Event): void {
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    const path = getRequestURL(event).pathname
    const key = `${ip}:${path}`
    const now = Date.now()

    const entry = store.get(key)

    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return
    }

    entry.count++

    if (entry.count > maxAttempts) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000)
      setResponseHeader(event, 'Retry-After', retryAfterSec)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many requests. Please try again later.',
      })
    }
  }
}

/** Exported for testing — clears all rate limit entries */
export function _clearRateLimitStore(): void {
  store.clear()
}
