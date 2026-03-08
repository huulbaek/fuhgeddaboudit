import { count, eq, and, ne } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { protocolSessions, anonymousCompletions } from '../../database/schema'

export default defineEventHandler(async () => {
  const [registered] = await db
    .select({ count: count() })
    .from(protocolSessions)
    .where(and(eq(protocolSessions.completed, true), ne(protocolSessions.module, 'preparation')))

  const [anonymous] = await db
    .select({ count: count() })
    .from(anonymousCompletions)

  return { count: (registered?.count ?? 0) + (anonymous?.count ?? 0) }
})
