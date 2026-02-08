import { eq, desc } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { userStatus, protocolSessions } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const screeningEnabled = config.public.screeningEnabled
  const userId = event.context.userId as string

  const [status] = await db
    .select({
      screeningComplete: userStatus.screeningComplete,
      preparationComplete: userStatus.preparationComplete,
      activeModule: userStatus.activeModule,
      lastTriageResult: userStatus.lastTriageResult,
    })
    .from(userStatus)
    .where(eq(userStatus.userId, userId))

  // If no status row exists yet, return defaults
  if (!status) {
    return {
      screeningComplete: screeningEnabled ? false : true,
      preparationComplete: false,
      activeModule: null,
      lastTriageResult: null,
      recentSessions: [],
    }
  }

  // Fetch the 3 most recent protocol sessions (excluding preparation)
  const recentSessions = await db
    .select({
      id: protocolSessions.id,
      module: protocolSessions.module,
      startedAt: protocolSessions.startedAt,
      completed: protocolSessions.completed,
      aborted: protocolSessions.aborted,
    })
    .from(protocolSessions)
    .where(eq(protocolSessions.userId, userId))
    .orderBy(desc(protocolSessions.startedAt))
    .limit(3)

  return {
    screeningComplete: screeningEnabled ? status.screeningComplete : true,
    preparationComplete: status.preparationComplete,
    activeModule: status.activeModule,
    lastTriageResult: status.lastTriageResult,
    recentSessions: recentSessions.filter((s) => s.module !== 'preparation'),
  }
})
