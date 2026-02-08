import { describe, it, expect } from 'vitest'

describe('user status endpoint logic', () => {
  it('returns defaults when no status row exists', () => {
    const status = undefined
    const result = status
      ? {
          screeningComplete: status.screeningComplete,
          preparationComplete: status.preparationComplete,
          activeModule: status.activeModule,
          lastTriageResult: status.lastTriageResult,
          recentSessions: [],
        }
      : {
          screeningComplete: false,
          preparationComplete: false,
          activeModule: null,
          lastTriageResult: null,
          recentSessions: [],
        }

    expect(result.screeningComplete).toBe(false)
    expect(result.preparationComplete).toBe(false)
    expect(result.activeModule).toBeNull()
    expect(result.lastTriageResult).toBeNull()
    expect(result.recentSessions).toEqual([])
  })

  it('returns full status when row exists with active module', () => {
    const status = {
      screeningComplete: true,
      preparationComplete: true,
      activeModule: 'rtm',
      lastTriageResult: 'rtm',
    }
    const sessions = [
      { id: 's1', module: 'rtm', startedAt: '2026-01-10T10:00:00Z', completed: true, aborted: false },
      { id: 's2', module: 'rtm', startedAt: '2026-01-12T10:00:00Z', completed: false, aborted: false },
    ]

    const result = {
      ...status,
      recentSessions: sessions.filter((s) => s.module !== 'preparation'),
    }

    expect(result.screeningComplete).toBe(true)
    expect(result.preparationComplete).toBe(true)
    expect(result.activeModule).toBe('rtm')
    expect(result.recentSessions).toHaveLength(2)
  })

  it('filters out preparation sessions from recent sessions', () => {
    const sessions = [
      { id: 's1', module: 'preparation', startedAt: '2026-01-08T10:00:00Z', completed: true, aborted: false },
      { id: 's2', module: 'tetris', startedAt: '2026-01-10T10:00:00Z', completed: true, aborted: false },
      { id: 's3', module: 'rtm', startedAt: '2026-01-12T10:00:00Z', completed: false, aborted: true },
    ]

    const filtered = sessions.filter((s) => s.module !== 'preparation')
    expect(filtered).toHaveLength(2)
    expect(filtered[0].module).toBe('tetris')
    expect(filtered[1].module).toBe('rtm')
  })

  it('returns partial progress when only screening is complete', () => {
    const status = {
      screeningComplete: true,
      preparationComplete: false,
      activeModule: null,
      lastTriageResult: null,
    }

    expect(status.screeningComplete).toBe(true)
    expect(status.preparationComplete).toBe(false)
    expect(status.activeModule).toBeNull()
  })
})
