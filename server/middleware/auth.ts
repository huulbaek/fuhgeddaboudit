import { verifyToken } from '../utils/auth'

const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/auth/logout']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/') || PUBLIC_ROUTES.includes(path)) {
    return
  }

  const token = getCookie(event, 'auth_token')
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  try {
    const payload = verifyToken(token)
    event.context.userId = payload.userId
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' })
  }
})
