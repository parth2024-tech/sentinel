import { randomBytes } from "crypto";

// Base32 alphabet (Crockford, lowercase) — URL-safe, unambiguous
const B32 = "0123456789abcdefghjkmnpqrstvwxyz";

function randomBase32(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => B32[b & 0x1f])
    .join("");
}

/** 12-character base32 report ID (~60 bits of entropy) */
export function newReportId(): string {
  return randomBase32(12);
}

/** 16-character base32 claim token (~80 bits of entropy) */
export function newClaimToken(): string {
  return randomBase32(16);
}

/** 20-character base32 public share token (~100 bits of entropy) */
export function newShareToken(): string {
  return randomBase32(20);
}

/**
 * 8-character unambiguous pair code formatted as XXXX-XXXX.
 * Uses a restricted alphabet: A-Z and 2-9 minus look-alikes (0,O,1,I,L).
 * Example output: "K7M2-P9R4"
 */
const PAIR_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newPairCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes).map((b) => PAIR_ALPHABET[b % PAIR_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

/** SHA-256 hex of a string — used for IP hashing before storage */
export async function sha256hex(input: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input).digest("hex");
}
