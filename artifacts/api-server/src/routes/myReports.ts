import {
  db,
  withUserScope,
  reportsTable,
  magicLinkTokensTable,
  myReportsSessionsTable,
  reportHabitAnswersTable,
  reportPayloadsTable,
  usersTable,
  devicesTable,
  organizationMembersTable,
} from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import crypto from "node:crypto";
import { z } from "zod";
import { Router, type Request } from "express";
import { MAGIC_LINK_TTL_MIN } from "../lib/magicLinkConstants.js";
import { isResendConfigured } from "../lib/email/config.js";
import { buildMagicLinkLoginEmail } from "../lib/email/templates/magicLinkLogin.js";
import { sendTransactionalEmail } from "../lib/email/resendMailer.js";
import { consumeRateLimit } from "../lib/rateLimit.js";

const router = Router();

const SESSION_COOKIE = "sentinel_session";
const SESSION_TTL_DAYS = 30;

function newToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getSession(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[SESSION_COOKIE] ?? cookies?.["__Host-sentinel_session"] ?? null;
}

async function resolveEmail(sessionToken: string): Promise<string | null> {
  const sessionHash = hashToken(sessionToken);
  const now = new Date();
  const rows = await db
    .select()
    .from(myReportsSessionsTable)
    .where(
      and(
        eq(myReportsSessionsTable.token, sessionHash),
        gt(myReportsSessionsTable.expiresAt, now)
      )
    )
    .limit(1);
  return rows[0]?.email ?? null;
}

// ── POST /api/my-reports/request ──────────────────────────────────────────────
// Creates a magic-link token. In development returns `devToken` only when
// explicitly enabled; in production sends email via Resend (requires RESEND_API_KEY).

const RequestBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

router.post("/request", async (req, res) => {
  const parsed = RequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid email address." });
    return;
  }

  const { email } = parsed.data;

  // Rate limiting: 5 requests per 15m per IP, 3 requests per 15m per email
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  const emailHash = crypto.createHash("sha256").update(email).digest("hex");

  const [allowIp, allowEmail] = await Promise.all([
    consumeRateLimit(`magic-req:ip:${ipHash}`, 15, 5),
    consumeRateLimit(`magic-req:email:${emailHash}`, 15, 3),
  ]);

  if (!allowIp || !allowEmail) {
    res.status(429).json({ error: "Too many magic link requests. Please wait a few minutes." });
    return;
  }

  const token = newToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000);

  await db.insert(magicLinkTokensTable).values({ token: tokenHash, email, expiresAt });

  req.log.info({ email }, "magic_link_requested");

  // Only leak devToken if explicitly running in development AND allowed via env
  const allowDevToken = process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_TOKEN_LEAK === "true";

  if (allowDevToken) {
    res.json({
      ok: true,
      devToken: token,
    });
    return;
  }

  if (!isResendConfigured()) {
    await db
      .delete(magicLinkTokensTable)
      .where(eq(magicLinkTokensTable.token, tokenHash));
    res.status(503).json({
      error:
        "Email delivery is not configured. Set RESEND_API_KEY (and RESEND_FROM_EMAIL for your domain).",
    });
    return;
  }

  try {
    const { subject, html, text } = buildMagicLinkLoginEmail(token, "login");
    await sendTransactionalEmail({ to: email, subject, html, text });
  } catch (err) {
    await db
      .delete(magicLinkTokensTable)
      .where(eq(magicLinkTokensTable.token, tokenHash));
    req.log.error({ err, email }, "magic_link_email_failed");
    res.status(502).json({
      error: "Could not send the sign-in email. Try again in a moment.",
    });
    return;
  }

  res.json({ ok: true });
});

// ── GET /api/my-reports/verify ────────────────────────────────────────────────
// Validates magic-link token, creates a session cookie, redirects to /my-reports.

router.get("/verify", async (req, res) => {
  // Guard against enterprise email scanner / prefetch bots consuming the single-use token
  const purpose = req.headers["purpose"] || req.headers["sec-purpose"] || req.headers["x-purpose"];
  if (req.method === "HEAD" || purpose === "prefetch" || purpose === "preview") {
    res.status(204).end();
    return;
  }

  const rawToken = typeof req.query.token === "string" ? req.query.token : null;
  if (!rawToken || rawToken.length < 16) {
    res.status(400).json({ error: "Missing or invalid token." });
    return;
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  // Atomic single-query consumption with RETURNING to prevent TOCTOU race conditions
  const updatedRows = await db
    .update(magicLinkTokensTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(magicLinkTokensTable.token, tokenHash),
        isNull(magicLinkTokensTable.usedAt),
        gt(magicLinkTokensTable.expiresAt, now)
      )
    )
    .returning({ email: magicLinkTokensTable.email });

  const row = updatedRows[0];
  if (!row) {
    res.status(401).json({ error: "Invalid or expired magic link." });
    return;
  }

  const { email } = row;

  // Create session with hashed token storage
  const sessionToken = newToken();
  const sessionHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(myReportsSessionsTable).values({ token: sessionHash, email, expiresAt });

  req.log.info({ email }, "my_reports_session_created");

  // Finalize pending device claims for this verified email
  try {
    const userRows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    let userId = userRows[0]?.id;
    if (!userId) {
      const newUserId = createId();
      await db.insert(usersTable).values({
        id: newUserId,
        email,
        name: email.split("@")[0] || "User",
      });
      userId = newUserId;
    }

    const memberships = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.userId, userId)).limit(1);
    const orgId = memberships[0]?.orgId ?? null;

    await db
      .update(devicesTable)
      .set({
        claimed: true,
        claimedAt: new Date(),
        userId,
        orgId,
        pendingClaimEmail: null,
      })
      .where(eq(devicesTable.pendingClaimEmail, email));
  } catch (claimErr) {
    req.log.warn({ claimErr, email }, "failed_to_finalize_pending_devices");
  }

  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";

  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  // Redirect safely to my-reports page (frontend route)
  const rawBase = (process.env.BASE_PATH ?? "").trim();
  let safeBase = "";
  if (rawBase.startsWith("http://") || rawBase.startsWith("https://")) {
    try {
      safeBase = new URL(rawBase).origin;
    } catch {
      safeBase = "";
    }
  } else if (rawBase.startsWith("/")) {
    safeBase = rawBase;
  }
  res.redirect(`${safeBase}/my-reports?verified=1`);
});

// ── GET /api/my-reports ───────────────────────────────────────────────────────
// Returns all reports claimed by the authenticated email.

router.get("/", async (req, res) => {
  const sessionToken = getSession(req);
  if (!sessionToken) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const email = await resolveEmail(sessionToken);
  if (!email) {
    res.status(401).json({ error: "Session expired." });
    return;
  }

  const userRows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = userRows[0];

  let reports: {
    id: string;
    resultJson: unknown;
    createdAt: Date;
    habitScore: number | null;
    combinedScore: number | null;
  }[] = [];

  if (user) {
    // Single LEFT JOIN query fetches reports and habit scores in one round-trip,
    // executed inside withUserScope so claimed reports belonging to this user
    // are visible even when assigned to an organization under PostgreSQL RLS.
    reports = await withUserScope(user.id, async (tx) => {
      return await tx
        .select({
          id: reportsTable.id,
          resultJson: reportPayloadsTable.resultJson,
          createdAt: reportsTable.createdAt,
          habitScore: reportHabitAnswersTable.habitScore,
          combinedScore: reportHabitAnswersTable.combinedScore,
        })
        .from(reportsTable)
        .innerJoin(reportPayloadsTable, eq(reportsTable.id, reportPayloadsTable.reportId))
        .leftJoin(
          reportHabitAnswersTable,
          eq(reportsTable.id, reportHabitAnswersTable.reportId)
        )
        .where(
          and(
            eq(reportsTable.userId, user.id),
            isNull(reportsTable.deletedAt),
            eq(reportsTable.claimed, true)
          )
        )
        .orderBy(reportsTable.createdAt);
    });
  }

  res.json({
    email,
    reports: reports.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      result: r.resultJson,
      habitScore: r.habitScore ?? null,
      combinedScore: r.combinedScore ?? null,
    })),
  });
});

// ── DELETE /api/my-reports/session ───────────────────────────────────────────
// Sign out.

router.delete("/session", async (req, res) => {
  const sessionToken = getSession(req);
  if (sessionToken) {
    const sessionHash = hashToken(sessionToken);
    await db
      .delete(myReportsSessionsTable)
      .where(eq(myReportsSessionsTable.token, sessionHash))
      .catch(() => {});
  }
  res.clearCookie("__Host-sentinel_session", { path: "/", secure: true });
  res.clearCookie("sentinel_session", { path: "/" });
  res.json({ ok: true });
});

export default router;
