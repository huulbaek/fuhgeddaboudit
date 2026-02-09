const STORAGE_KEY = 'mnemosyne-guest-data'

interface GuestScreeningResult {
  instrument: string
  score: number
  result: string
  completedAt: string
}

interface GuestSudsRating {
  id: string
  rating: number
  phase: string
  recordedAt: string
}

interface GuestTntData {
  totalTrials: number
  thinkTrials: number
  noThinkTrials: number
  gazeCompliancePct: number | null
  avgReactionTimeMs: number | null
}

interface GuestSession {
  id: string
  module: string
  startedAt: string
  endedAt: string | null
  completed: boolean
  aborted: boolean
  abortReason: string | null
  sudsRatings: GuestSudsRating[]
  tntData: GuestTntData | null
}

interface GuestGroundingEvent {
  id: string
  triggeredAt: string
  durationSecs: number
  context: string
}

export interface GuestData {
  status: {
    screeningComplete: boolean
    preparationComplete: boolean
    activeModule: string | null
    lastTriageResult: string | null
  }
  screeningResults: GuestScreeningResult[]
  sessions: GuestSession[]
  groundingEvents: GuestGroundingEvent[]
}

function defaultGuestData(): GuestData {
  return {
    status: {
      screeningComplete: false,
      preparationComplete: false,
      activeModule: null,
      lastTriageResult: null,
    },
    screeningResults: [],
    sessions: [],
    groundingEvents: [],
  }
}

export function useGuestStore() {
  const data = useState<GuestData>('guest-data', () => defaultGuestData())

  function load() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        data.value = JSON.parse(raw)
      }
    } catch {
      // Corrupted data — reset
      data.value = defaultGuestData()
    }
  }

  function persist() {
    if (!import.meta.client) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
  }

  function clear() {
    data.value = defaultGuestData()
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  // --- Status ---

  function getStatus() {
    return data.value.status
  }

  function updateStatus(patch: Partial<GuestData['status']>) {
    data.value.status = { ...data.value.status, ...patch }
    persist()
  }

  // --- Screening ---

  function addScreeningResult(result: GuestScreeningResult) {
    data.value.screeningResults.push(result)
    persist()
  }

  function getScreeningResults() {
    return data.value.screeningResults
  }

  // --- Sessions ---

  function createSession(module: string): GuestSession {
    const session: GuestSession = {
      id: crypto.randomUUID(),
      module,
      startedAt: new Date().toISOString(),
      endedAt: null,
      completed: false,
      aborted: false,
      abortReason: null,
      sudsRatings: [],
      tntData: null,
    }
    data.value.sessions.push(session)
    persist()
    return session
  }

  function getSession(id: string) {
    return data.value.sessions.find(s => s.id === id) ?? null
  }

  function updateSession(id: string, patch: Partial<Pick<GuestSession, 'completed' | 'aborted' | 'abortReason' | 'endedAt'>>) {
    const session = data.value.sessions.find(s => s.id === id)
    if (!session) return null
    Object.assign(session, patch)
    if (patch.completed || patch.aborted) {
      session.endedAt = new Date().toISOString()
    }
    persist()
    return session
  }

  function addSudsRating(sessionId: string, rating: number, phase: string) {
    const session = data.value.sessions.find(s => s.id === sessionId)
    if (!session) return
    session.sudsRatings.push({
      id: crypto.randomUUID(),
      rating,
      phase,
      recordedAt: new Date().toISOString(),
    })
    persist()
  }

  function saveTntData(sessionId: string, tntData: GuestTntData) {
    const session = data.value.sessions.find(s => s.id === sessionId)
    if (!session) return
    session.tntData = tntData
    persist()
  }

  function getSessions() {
    return data.value.sessions
  }

  function getRecentSessions(limit = 3) {
    return [...data.value.sessions]
      .filter(s => s.module !== 'preparation')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit)
  }

  // --- Grounding ---

  function addGroundingEvent(event: Omit<GuestGroundingEvent, 'id'>) {
    data.value.groundingEvents.push({
      id: crypto.randomUUID(),
      ...event,
    })
    persist()
  }

  return {
    data,
    load,
    persist,
    clear,
    getStatus,
    updateStatus,
    addScreeningResult,
    getScreeningResults,
    createSession,
    getSession,
    updateSession,
    addSudsRating,
    saveTntData,
    getSessions,
    getRecentSessions,
    addGroundingEvent,
  }
}
