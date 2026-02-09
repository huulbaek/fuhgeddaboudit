export default defineNuxtPlugin(async () => {
  const { fetchUser, isLoggedIn, restoreGuestMode } = useAuth()
  await fetchUser()

  // If no authenticated session, check for saved guest mode
  if (!isLoggedIn.value && import.meta.client) {
    restoreGuestMode()
  }
})
