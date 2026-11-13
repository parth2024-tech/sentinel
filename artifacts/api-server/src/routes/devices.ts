import { Router, type Request } from "express";
import { z } from "zod";
import crypto, { randomBytes } from "crypto";
import {
  db,
  devicesTable,
  usersTable,
  organizationsTable,
  organizationMembersTable,
  myReportsSessionsTable,
  magicLinkTokensTable,
} from "@workspace/db";
import { eq, and, gt, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { consumeRateLimit } from "../lib/rateLimit.js";
import { sha256hex } from "../lib/ids.js";
import { timingSafeEqualStr } from "../lib/crypto.js";
import { MAGIC_LINK_TTL_MIN } from "../lib/magicLinkConstants.js";
import { isResendConfigured } from "../lib/email/config.js";
import { buildMagicLinkLoginEmail } from "../lib/email/templates/magicLinkLogin.js";
import { sendTransactionalEmail } from "../lib/email/resendMailer.js";

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

  // ── Session check for verified ownership binding ────────────────────────────
  const cookies = req.cookies as Record<string, string> | undefined;
  const sessionToken = cookies?.["__Host-sentinel_session"] || cookies?.["sentinel_session"];

  let verifiedUser: { id: string; email: string } | null = null;
  let verifiedOrgId: string | null = null;

  if (sessionToken && sessionToken.length >= 16) {
    const sessionHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
    const sessionRows = await db
      .select()
      .from(myReportsSessionsTable)
      .where(
        and(
          eq(myReportsSessionsTable.token, sessionHash),
          gt(myReportsSessionsTable.expiresAt, now)
        )
      )
      .limit(1);

    const activeSession = sessionRows[0];
    if (activeSession) {
      const userRows = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, activeSession.email))
        .limit(1);

      if (userRows[0]) {
        verifiedUser = { id: userRows[0].id, email: userRows[0].email };
      } else {
        const newUid = createId();
        await db.insert(usersTable).values({
          id: newUid,
          email: activeSession.email,
          name: activeSession.email.split("@")[0] || "User",
        });
        verifiedUser = { id: newUid, email: activeSession.email };
      }

      // Check organization membership
      const memberRows = await db
        .select()
        .from(organizationMembersTable)
        .where(eq(organizationMembersTable.userId, verifiedUser.id))
        .limit(1);

      if (memberRows[0]) {
        verifiedOrgId = memberRows[0].orgId;
      } else {
        const orgRows = await db
          .select()
          .from(organizationsTable)
          .where(eq(organizationsTable.ownerId, verifiedUser.id))
          .limit(1);
        if (orgRows[0]) verifiedOrgId = orgRows[0].id;
      }
    }
  }

  if (verifiedUser) {
    // Verified authenticated session: bind foreign keys directly
    await db
      .update(devicesTable)
      .set({
        claimed: true,
        claimedAt: new Date(),
        userId: verifiedUser.id,
        orgId: verifiedOrgId,
        pendingClaimEmail: null,
      })
      .where(eq(devicesTable.id, device.id));

    req.log.info({ deviceId: device.id, userId: verifiedUser.id, orgId: verifiedOrgId }, "device_claimed_verified");
    res.json({ deviceId: device.id, claimed: true, verified: true });
    return;
  }

  // Unauthenticated user claiming via email:
  // Store as pending_claim_email and send magic verification link.
  // Foreign keys (userId/orgId) are NEVER bound until the email magic link is confirmed.
  const claimEmail = parsed.data.email.toLowerCase();
  await db
    .update(devicesTable)
    .set({
      pendingClaimEmail: claimEmail,
    })
    .where(eq(devicesTable.id, device.id));

  // Issue magic link for verification
  const linkToken = crypto.randomBytes(32).toString("hex");
  const linkTokenHash = crypto.createHash("sha256").update(linkToken).digest("hex");
  const linkExpiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000);

  await db.insert(magicLinkTokensTable).values({
    token: linkTokenHash,
    email: claimEmail,
    expiresAt: linkExpiresAt,
  });

  const allowDevToken = process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_TOKEN_LEAK === "true";

  if (isResendConfigured()) {
    try {
      const { subject, html, text } = buildMagicLinkLoginEmail(linkToken, "login");
      await sendTransactionalEmail({ to: claimEmail, subject, html, text });
    } catch (err) {
      req.log.error({ err, email: claimEmail }, "magic_link_device_claim_email_failed");
    }
  }

  req.log.info({ deviceId: device.id, email: claimEmail }, "device_claim_pending_verification");
  res.json({
    deviceId: device.id,
    claimed: false,
    pendingVerification: true,
    message: "A verification link has been sent to confirm device ownership.",
    ...(allowDevToken ? { devToken: linkToken } : {}),
  });
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
