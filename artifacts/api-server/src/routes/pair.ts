import { Router, type Request } from "express";
import { z } from "zod";
import { db, pairSessionsTable, reportsTable } from "@workspace/db";
import { SentinelReportSchema, generateReport } from "@workspace/report-engine";
import { eq, lt } from "drizzle-orm";
import { newPairCode, newReportId, newClaimToken, sha256hex } from "../lib/ids";
import { ReportsService } from "../services/reports.service";
import { consumeRateLimit } from "../lib/rateLimit";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAIR_TTL_MS = 15 * 60 * 1000; // 15 minutes

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

  if (rows.length === 0) {
    res.json({ status: "expired" });
    return;
  }

  const session = rows[0];

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

  // Rate limit: 3 requests per pair code (code is the key, not IP)
  const codeRlKey = `pair_push:${normalizedCode}`;
  const allowed = await consumeRateLimit(codeRlKey, 15, 3);
  if (!allowed) {
    res.set("Retry-After", "900");
    res.status(429).json({ error: "Too many push attempts for this code." });
    return;
  }

  const now = new Date();

  // Note: Expired session cleanup has been moved to a background task
  // to avoid database lock contention under high load on this endpoint.

  // Validate pair session
  const sessionRows = await db
    .select()
    .from(pairSessionsTable)
    .where(eq(pairSessionsTable.code, normalizedCode))
    .limit(1);

  if (sessionRows.length === 0) {
    res.status(404).json({ error: "Pair code not found or expired." });
    return;
  }

  const session = sessionRows[0];

  if (session.expiresAt < now) {
    res.status(410).json({ error: "Pair code has expired." });
    return;
  }

  if (session.reportId) {
    // Already pushed — return the existing report ID (idempotent)
    res.json({ ok: true, reportId: session.reportId });
    return;
  }

  // Validate rawJson against SentinelReportSchema
  const reportParsed = SentinelReportSchema.safeParse(rawJson);
  if (!reportParsed.success) {
    const first = reportParsed.error.issues[0];
    res.status(422).json({
      error: "Invalid report data",
      details: `${first.path.join(".")}: ${first.message}`,
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
  } catch (error: any) {
    req.log.error({ err: error }, "Failed to create pair report");
    res.status(500).json({ error: "Failed to create report" });
  }

  res.status(500).json({ error: "Failed to generate unique report ID" });
});

export default router;
