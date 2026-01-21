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
