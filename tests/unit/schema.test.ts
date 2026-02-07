import { describe, it, expect } from 'vitest'
import {
  users,
  screeningResults,
  userStatus,
  protocolSessions,
  sudsRatings,
  tntSessionData,
  groundingEvents,
} from '../../server/database/schema'
import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

describe('database schema', () => {
  it('exports all 7 tables', () => {
    expect(users).toBeDefined()
    expect(screeningResults).toBeDefined()
    expect(userStatus).toBeDefined()
    expect(protocolSessions).toBeDefined()
    expect(sudsRatings).toBeDefined()
    expect(tntSessionData).toBeDefined()
    expect(groundingEvents).toBeDefined()
  })

  it('tables have correct SQL names', () => {
    expect(getTableName(users)).toBe('users')
    expect(getTableName(screeningResults)).toBe('screening_results')
    expect(getTableName(userStatus)).toBe('user_status')
    expect(getTableName(protocolSessions)).toBe('protocol_sessions')
    expect(getTableName(sudsRatings)).toBe('suds_ratings')
    expect(getTableName(tntSessionData)).toBe('tnt_session_data')
    expect(getTableName(groundingEvents)).toBe('grounding_events')
  })

  it('users table has expected columns', () => {
    const cols = Object.keys(users)
    expect(cols).toContain('id')
    expect(cols).toContain('email')
    expect(cols).toContain('passwordHash')
    expect(cols).toContain('createdAt')
  })

  it('sudsRatings has a check constraint for rating 0-10', () => {
    const config = getTableConfig(sudsRatings)
    expect(config.checks.length).toBeGreaterThan(0)
    expect(config.checks[0].name).toBe('rating_range')
  })
})
