export function useProgressService() {
  const { isGuest } = useAuth()

  async function get() {
    if (isGuest.value) {
      return computeGuestProgress()
    }
    return await $fetch('/api/progress')
  }

  function computeGuestProgress() {
    const store = useGuestStore()
    const allSessions = store.getSessions().filter(s => s.module !== 'preparation')
    const sorted = [...allSessions].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )

    const sessionCount = sorted.length
    const completedCount = sorted.filter(s => s.completed).length
    const abortedCount = sorted.filter(s => s.aborted).length

    // Streak: consecutive completed sessions from most recent
    let currentStreak = 0
    for (const s of sorted) {
      if (s.completed) currentStreak++
      else break
    }

    // SUDS trend
    const sudsTrend = sorted.map((s) => {
      const pre = s.sudsRatings.find(r => r.phase === 'pre')
      const post = s.sudsRatings.find(r => r.phase === 'post')
      return {
        sessionId: s.id,
        module: s.module,
        date: s.startedAt,
        preRating: pre?.rating ?? null,
        postRating: post?.rating ?? null,
      }
    })

    // Session history
    const sessionHistory = sorted.map(s => ({
      id: s.id,
      module: s.module,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      completed: s.completed,
      aborted: s.aborted,
      abortReason: s.abortReason,
    }))

    // Module stats
    const moduleStats: Record<string, { completedSessions: number; [key: string]: unknown }> = {}
    const modules = ['tetris', 'rtm', 'tnt', 'emdr'] as const

    for (const mod of modules) {
      const modSessions = sorted.filter(s => s.module === mod && s.completed)
      if (modSessions.length === 0) continue

      if (mod === 'tnt') {
        const complianceValues = modSessions
          .filter(s => s.tntData?.gazeCompliancePct != null)
          .map(s => s.tntData!.gazeCompliancePct!)
        const avgCompliance = complianceValues.length > 0
          ? complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length
          : null
        moduleStats.tnt = { completedSessions: modSessions.length, avgCompliancePct: avgCompliance }
      } else if (mod === 'rtm') {
        const loopCounts: number[] = []
        for (const s of modSessions) {
          const midPostRatings = s.sudsRatings
            .filter(r => r.phase.startsWith('mid_loop') || r.phase === 'post')
            .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
          let loops = midPostRatings.length
          for (let i = 0; i < midPostRatings.length; i++) {
            if (midPostRatings[i].rating <= 3) {
              loops = i + 1
              break
            }
          }
          loopCounts.push(loops)
        }
        const avgLoops = loopCounts.length > 0
          ? loopCounts.reduce((a, b) => a + b, 0) / loopCounts.length
          : null
        moduleStats.rtm = { completedSessions: modSessions.length, avgLoopsToTarget: avgLoops }
      } else {
        moduleStats[mod] = { completedSessions: modSessions.length }
      }
    }

    return {
      sessionCount,
      completedCount,
      abortedCount,
      currentStreak,
      sudsTrend,
      sessionHistory,
      moduleStats,
    }
  }

  return { get }
}
