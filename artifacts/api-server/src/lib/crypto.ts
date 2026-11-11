import crypto from "node:crypto";

/**
 * Constant-time string comparison using SHA-256 digests.
 * Prevents timing side-channel attacks on tokens, secrets, and hashes.
 */
export function timingSafeEqualStr(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Canonical JSON hashing with recursively sorted keys.
 * Ensures consistent hash generation regardless of object key order.
 */
export function canonicalJsonHash(obj: unknown): string {
  const canonical = JSON.stringify(obj, (_, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.keys(val as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = (val as Record<string, unknown>)[k];
            return acc;
          }, {})
      : val
  );
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Validates and retrieves the server secret.
 * In production, fails hard if SERVER_SECRET is missing or less than 32 characters.
 */
export function getRequiredServerSecret(): string {
  const secret = process.env.SERVER_SECRET?.trim();
  if (!secret || secret.length < 32 || secret === "sentinel-default-server-secret-key-32-chars-long") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: SERVER_SECRET environment variable must be explicitly configured and >= 32 characters in production.");
    }
    return secret && secret.length >= 32 ? secret : "sentinel-default-server-secret-key-32-chars-long";
  }
  return secret;
}
