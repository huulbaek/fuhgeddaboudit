import { assertJwtSecretConfigured } from '../utils/auth'

// A misconfigured production server should refuse to boot, not fail on the
// first login attempt.
export default defineNitroPlugin(() => {
  assertJwtSecretConfigured()
})
