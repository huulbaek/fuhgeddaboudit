import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('CSP configuration in nuxt.config.ts', () => {
  const configContent = readFileSync(resolve(__dirname, '../../nuxt.config.ts'), 'utf-8')

  it('defines a Content-Security-Policy header', () => {
    expect(configContent).toContain('Content-Security-Policy')
  })

  it('restricts default-src to self', () => {
    expect(configContent).toContain("default-src 'self'")
  })

  it('blocks object embeds', () => {
    expect(configContent).toContain("object-src 'none'")
  })

  it('blocks framing', () => {
    expect(configContent).toContain("frame-ancestors 'none'")
  })

  it('restricts connect-src to self plus TensorFlow model hosts', () => {
    expect(configContent).toContain("connect-src 'self'")
    expect(configContent).toContain('https://tfhub.dev')
    expect(configContent).toContain('https://storage.googleapis.com')
  })

  it('restricts form-action to self', () => {
    expect(configContent).toContain("form-action 'self'")
  })

  it('includes X-Content-Type-Options nosniff', () => {
    expect(configContent).toContain('X-Content-Type-Options')
    expect(configContent).toContain('nosniff')
  })

  it('includes X-Frame-Options DENY', () => {
    expect(configContent).toContain('X-Frame-Options')
    expect(configContent).toContain('DENY')
  })

  it('includes Referrer-Policy', () => {
    expect(configContent).toContain('Referrer-Policy')
    expect(configContent).toContain('strict-origin-when-cross-origin')
  })
})
