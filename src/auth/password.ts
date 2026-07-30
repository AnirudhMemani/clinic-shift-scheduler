import bcrypt from "bcryptjs";

/**
 * Password hashing helpers.
 *
 * bcryptjs (pure JS) is used over the native `bcrypt` so there's no native
 * build step to worry about on Vercel. 12 rounds is a sensible default cost.
 */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
