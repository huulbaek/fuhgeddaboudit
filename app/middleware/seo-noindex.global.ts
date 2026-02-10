const PUBLIC_PATHS = new Set(['/', '/terms', '/auth/login', '/auth/register'])

export default defineNuxtRouteMiddleware((to) => {
  if (!PUBLIC_PATHS.has(to.path)) {
    useHead({
      meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    })
  }
})
