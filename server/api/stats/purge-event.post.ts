import { db } from '../../database/drizzle'
import { anonymousCompletions } from '../../database/schema'

const VALID_MODULES = ['tnt', 'rtm', 'tetris', 'emdr']

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const module = body?.module

  if (!module || !VALID_MODULES.includes(module)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid module' })
  }

  await db.insert(anonymousCompletions).values({ module })

  return { ok: true }
})
