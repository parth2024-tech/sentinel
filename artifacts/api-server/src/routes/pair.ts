import { Router, type Request } from "express";
import { z } from "zod";
import { db, pairSessionsTable } from "@workspace/db";
import { SentinelReportSchema } from "@workspace/report-engine";
import { eq } from "drizzle-orm";
import { newPairCode, sha256hex } from "../lib/ids.js";
import { ReportsService } from "../services/reports.service.js";
import { consumeRateLimit } from "../lib/rateLimit.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAIR_TTL_MS = 10 * 60 * 1000; // 10 minutes (RFC 8628 Device Authorization Grant)

function getClientIp(req: Request): string {
  // Use Express's built-in req.ip which respects the "trust proxy" setting.
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

// ── POST /api/pair/session ────────────────────────────────────────────────────
// Creates a new pair session and returns the code to the browser.

router.post("/session", async (req, res) => {
  const ip = getClientIp(req);
  const ipHash = await sha256hex(ip);

  // Rate limit: 5 session creates per minute per IP
  const allowed = await consumeRateLimit(ipHash + ":pair_session", 1, 5);
  if (!allowed) {
    res.set("Retry-After", "60");
    res.status(429).json({ error: "Too many pair session requests. Wait a moment and try again." });
    return;
  }

  const code = newPairCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAIR_TTL_MS);

  await db.insert(pairSessionsTable).values({
    code,
    createdAt: now,
    expiresAt,
    reportId: null,
    claimToken: null,
    usedAt: null,
  });

  req.log.info({ code }, "pair_session_created");
  res.status(201).json({ code, expiresAt: expiresAt.toISOString() });
});

// ── GET /api/pair/session/:code ───────────────────────────────────────────────
// Polling endpoint. Returns pending / ready / expired.

router.get("/session/:code", async (req, res) => {
  const ip = getClientIp(req);
  const ipHash = await sha256hex(ip);
  const allowed = await consumeRateLimit(ipHash + ":pair_poll", 1, 60);
  if (!allowed) {
    res.set("Retry-After", "60");
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }

  const { code } = req.params;
  if (!code || code.length < 4) {
    res.status(400).json({ status: "expired" });
    return;
  }

  const now = new Date();

  const rows = await db
    .select()
    .from(pairSessionsTable)
    .where(eq(pairSessionsTable.code, code.toUpperCase()))
    .limit(1);

  const session = rows[0];
  if (!session) {
    res.json({ status: "expired" });
    return;
  }

  if (session.expiresAt < now) {
    res.json({ status: "expired" });
    return;
  }

  if (!session.reportId) {
    res.json({ status: "pending" });
    return;
  }

  // Mark usedAt on first "ready" pickup
  if (!session.usedAt) {
    await db
      .update(pairSessionsTable)
      .set({ usedAt: now })
      .where(eq(pairSessionsTable.code, code.toUpperCase()));
  }

  res.json({
    status: "ready",
    reportId: session.reportId,
    claimToken: session.claimToken,
  });
});

// ── POST /api/pair/push ───────────────────────────────────────────────────────
// Called by the diagnostic script. Validates the code, saves the report, and
// links the report ID back to the pair session.

const PushBody = z.object({
  pairCode: z.string().min(4).max(12),
  rawJson: z.record(z.unknown()),
});

router.post("/push", async (req, res) => {
  const ip = getClientIp(req);
  const ipHash = await sha256hex(ip);

  // 1. Sliding-window IP rate limit at the perimeter (10 requests/min per IP)
  const ipAllowed = await consumeRateLimit(ipHash + ":pair_push_ip", 1, 10);
  if (!ipAllowed) {
    res.set("Retry-After", "60");
    res.status(429).json({ error: "Too many push attempts from this IP. Please wait." });
    return;
  }

  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > 256 * 1024) {
    res.status(413).json({ error: "Payload too large. Maximum 256 KB." });
    return;
  }

  const parsed = PushBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Validation failed", details: parsed.error.message });
    return;
  }

  const { pairCode, rawJson } = parsed.data;
  const normalizedCode = pairCode.toUpperCase();

  const now = new Date();

  // Fix 2.2: Check attempt rate limit BEFORE executing database query to prevent DB exhaustion
  const attemptAllowed = await consumeRateLimit(ipHash + ":pair_attempt", 15, 10);
  if (!attemptAllowed) {
    res.set("Retry-After", "900");
    res.status(429).json({ error: "Excessive pairing attempts from this IP. Blocked for 15 minutes." });
    return;
  }

  // Validate pair session exists
  const sessionRows = await db
    .select()
    .from(pairSessionsTable)
    .where(eq(pairSessionsTable.code, normalizedCode))
    .limit(1);

  const session = sessionRows[0];
  if (!session) {
    // Unknown code guess: penalize IP scan counter to prevent code-space enumeration
    await consumeRateLimit(ipHash + ":pair_scan_fail", 15, 5);
    res.status(404).json({ error: "Pair code not found or expired." });
    return;
  }

  if (session.expiresAt < now) {
    res.status(410).json({ error: "Pair code has expired." });
    return;
  }

  if (session.reportId) {
    // Already pushed — return the existing report ID (idempotent)
    res.json({ ok: true, reportId: session.reportId });
    return;
  }

  // Rate limit: max 5 failed/repeated attempts on verified active session before burning
  const codeRlKey = `pair_push_burn:${normalizedCode}`;
  const allowed = await consumeRateLimit(codeRlKey, 15, 5);
  if (!allowed) {
    await db
      .update(pairSessionsTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(pairSessionsTable.code, normalizedCode));
    res.set("Retry-After", "900");
    res.status(410).json({ error: "Pairing code burned due to excessive failed attempts." });
    return;
  }

  // Validate rawJson against SentinelReportSchema
  const reportParsed = SentinelReportSchema.safeParse(rawJson);
  if (!reportParsed.success) {
    const first = reportParsed.error.issues[0];
    res.status(422).json({
      error: "Invalid report data",
      details: first ? `${first.path.join(".")}: ${first.message}` : "Validation failed",
    });
    return;
  }

  // Generate report + store it via ReportsService
  try {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const reportResult = await ReportsService.createReport({ rawJson }, ip, undefined, undefined, req.log);
    const reportId = reportResult.id;
    const claimToken = reportResult.claimToken;

    // Link the report back to the pair session
    await db
      .update(pairSessionsTable)
      .set({ reportId, claimToken })
      .where(eq(pairSessionsTable.code, normalizedCode));

    req.log.info({ reportId, pairCode: normalizedCode }, "pair_report_pushed");

    res.status(201).json({ ok: true, reportId, claimToken });
    return;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    req.log.error({ err }, "Failed to create pair report");
    res.status(500).json({ error: "Failed to create report" });
  }

  res.status(500).json({ error: "Failed to generate unique report ID" });
});

export default router;
