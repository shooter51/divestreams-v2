import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * Hash password using scrypt (same format as Better Auth)
 * Better Auth uses: N=16384, r=16, p=1, dkLen=64, format: "salt:hash"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    64, // dkLen
    { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }
  );

  return `${salt}:${key.toString("hex")}`;
}

/**
 * Verify a password against a stored hash
 * Uses same scrypt parameters as Better Auth / hashPassword
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, storedHash] = hash.split(":");
    if (!salt || !storedHash) return false;
    const key = await scryptAsync(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }
    );
    return key.toString("hex") === storedHash;
  } catch {
    return false;
  }
}

/**
 * Generate a random alphanumeric password.
 * Excludes ambiguous characters (0, O, l, 1, I) for readability.
 * Uses rejection sampling to avoid modulo bias.
 * @param length - Password length (default 16)
 */
export function generateRandomPassword(length: number = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  // Largest multiple of chars.length that fits in a byte (256)
  const maxValid = 256 - (256 % chars.length);
  let password = "";
  while (password.length < length) {
    const bytes = randomBytes(length - password.length);
    for (let i = 0; i < bytes.length && password.length < length; i++) {
      // Reject bytes >= maxValid to eliminate modulo bias
      if (bytes[i] < maxValid) {
        password += chars[bytes[i] % chars.length];
      }
    }
  }
  return password;
}
