import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SALT_ROUNDS = 12
const JWT_EXPIRES_IN = '7d'

// Keeps local setup zero-config. It is published with the source, so it must
// never sign a production session.
const DEV_JWT_SECRET = 'dev-secret-change-in-production'

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (process.env.NODE_ENV !== 'production') return secret || DEV_JWT_SECRET
  if (!secret || secret === DEV_JWT_SECRET) {
    throw new Error(
      'JWT_SECRET must be set to a private value in production. Generate one with: openssl rand -base64 48',
    )
  }
  return secret
}

/** Throws if this server could not sign sessions safely. Called once at startup. */
export function assertJwtSecretConfigured(): void {
  jwtSecret()
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: { userId: string }): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, jwtSecret()) as { userId: string }
}
