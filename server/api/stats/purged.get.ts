import { count, eq, and, ne } from 'drizzle-orm'
import { db } from '../../database/drizzle'
import { protocolSessions } from '../../database/schema'

export default defineEventHandler(async () => {
  const [result] = await db
    .select({ count: count() })
    .from(protocolSessions)
    .where(and(eq(protocolSessions.completed, true), ne(protocolSessions.module, 'preparation')))

  return { count: result?.count ?? 0 }
})
