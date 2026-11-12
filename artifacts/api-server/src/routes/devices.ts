import { Router, type Request } from "express";
import { z } from "zod";
import { db, devicesTable } from "@workspace/db";
import { eq, and, gt, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { consumeRateLimit } from "../lib/rateLimit.js";
import { sha256hex } from "../lib/ids.js";
import { timingSafeEqualStr } from "../lib/crypto.js";

const router = Router();

function newToken(len = 32): string {
  return randomBytes(len).toString("hex");
}

function newDeviceId(): string {
  return randomBytes(8).toString("hex");
}

function getClientIp(req: Request): string {
  // Use Express's built-in req.ip which respects the "trust proxy" setting.
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

// RFC 8628 Device Authorization Grant: Pair tokens expire after <= 10 minutes
const PAIR_TOKEN_TTL_MS = 10 * 60 * 1000;

// ── POST /api/devices/pair ────────────────────────────────────────────────────
// Called by the agent immediately after install. Returns a one-time pairToken
// (opened in the browser as /pair?token=<pairToken>) and a persistent
// deviceToken (used as Bearer token for all future report uploads).
// Stored in the DB strictly as SHA-256 digests.

router.post("/pair", async (req, res) => {
  // Rate limit: 5 pair requests per minute per IP (#6)
  const ip = getClientIp(req);
  const ipHash = await sha256hex(ip);
  const allowed = await consumeRateLimit(ipHash + ":device_pair", 1, 5);
  if (!allowed) {
    res.set("Retry-After", "60");
    res.status(429).json({ error: "Too many pair requests. Try again later." });
    return;
  }

  const pairToken = newToken(24);
  const deviceToken = newToken(32);
  const pairTokenHash = await sha256hex(pairToken);
  const deviceTokenHash = await sha256hex(deviceToken);
  const id = newDeviceId();
  const expiresAt = new Date(Date.now() + PAIR_TOKEN_TTL_MS);

  await db.insert(devicesTable).values({
    id,
    pairToken: pairTokenHash,
    deviceToken: deviceTokenHash,
    expiresAt,
  });

  req.log.info({ deviceId: id, ipHash }, "device_pair_initiated");

  res.status(201).json({ pairToken, deviceToken });
});

// ── POST /api/devices/claim ───────────────────────────────────────────────────
// Called from the browser /pair page. Binds the device to a user email.
// Strictly enforces max 5 failed attempts before permanently burning the pairing request.

const ClaimBody = z.object({
  pairToken: z.string().min(10).max(128),
  email: z.string().email().max(254),
});

router.post("/claim", async (req, res) => {
  const ip = getClientIp(req);
  const ipHash = await sha256hex(ip);

  // Rate limit: 20 claim requests per minute per IP
  const allowed = await consumeRateLimit(ipHash + ":device_claim", 1, 20);
  if (!allowed) {
    res.set("Retry-After", "60");
    res.status(429).json({ error: "Too many claim attempts. Try again later." });
    return;
  }

  // Brute force guard per IP
  const ipAttemptsAllowed = await consumeRateLimit(ipHash + ":device_claim_ip_fail", 15, 10);
  if (!ipAttemptsAllowed) {
    res.set("Retry-After", "900");
    res.status(429).json({ error: "Excessive failed claim attempts from this IP. Blocked for 15 minutes." });
    return;
  }

  const parsed = ClaimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid request", details: parsed.error.message });
    return;
  }

  const { pairToken } = parsed.data;
  const pairTokenHash = await sha256hex(pairToken);
  const now = new Date();

  // Find device matching either hash or plaintext legacy
  const rows = await db
    .select()
    .from(devicesTable)
    .where(
      and(
        or(eq(devicesTable.pairToken, pairTokenHash), eq(devicesTable.pairToken, pairToken)),
        gt(devicesTable.expiresAt, now)
      )
    )
    .limit(1);

  const device = rows[0];
  if (!device || (!timingSafeEqualStr(device.pairToken, pairTokenHash) && !timingSafeEqualStr(device.pairToken, pairToken))) {
    res.status(404).json({ error: "Invalid or expired pairing token" });
    return;
  }

  // Check token-specific brute-force limit (max 5 failed attempts before burning)
  const failKey = `device_pair_burn:${device.id}`;
  const tokenAttemptsAllowed = await consumeRateLimit(failKey, 15, 5);
  if (!tokenAttemptsAllowed) {
    // Burn pairing request immediately
    await db
      .update(devicesTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(devicesTable.id, device.id));
    req.log.warn({ deviceId: device.id, ipHash }, "device_pair_burned_excessive_attempts");
    res.status(410).json({ error: "Pairing request burned due to excessive failed attempts." });
    return;
  }

  if (device.claimed) {
    res.json({ deviceId: device.id, claimed: true, alreadyClaimed: true });
    return;
  }

  await db
    .update(devicesTable)
    .set({ claimed: true, claimedAt: new Date() })
    .where(eq(devicesTable.id, device.id));

  req.log.info({ deviceId: device.id, ipHash }, "device_claimed");

  res.json({ deviceId: device.id, claimed: true });
});

// ── GET /api/devices/pair-status ──────────────────────────────────────────────
// Polled by the browser /pair page to check whether the agent has initiated
// pairing yet (i.e. whether the pairToken is valid).

router.get("/pair-status", async (req, res) => {
  const token = req.query["token"];
  if (typeof token !== "string" || token.length < 10) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  const tokenHash = await sha256hex(token);
  const now = new Date();

  const rows = await db
    .select({ id: devicesTable.id, pairToken: devicesTable.pairToken, claimed: devicesTable.claimed })
    .from(devicesTable)
    .where(
      and(
        or(eq(devicesTable.pairToken, tokenHash), eq(devicesTable.pairToken, token)),
        gt(devicesTable.expiresAt, now)
      )
    )
    .limit(1);

  const foundDevice = rows[0];
  if (!foundDevice || (!timingSafeEqualStr(foundDevice.pairToken, tokenHash) && !timingSafeEqualStr(foundDevice.pairToken, token))) {
    res.status(404).json({ valid: false });
    return;
  }

  res.json({ valid: true, claimed: foundDevice.claimed });
});

export default router;
