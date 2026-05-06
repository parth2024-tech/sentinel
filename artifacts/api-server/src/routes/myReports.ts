import {
  db,
  reportsTable,
  magicLinkTokensTable,
  myReportsSessionsTable,
  reportHabitAnswersTable,
  reportPayloadsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, gt, isNull, isNotNull } from "drizzle-orm";
import crypto from "node:crypto";
import { z } from "zod";
import { Router, type Request } from "express";
import { MAGIC_LINK_TTL_MIN } from "../lib/magicLinkConstants";
import { isResendConfigured } from "../lib/email/config";
import { buildMagicLinkLoginEmail } from "../lib/email/templates/magicLinkLogin";
import { sendTransactionalEmail } from "../lib/email/resendMailer";

const router = Router();

const SESSION_COOKIE = "sentinel_session";
const SESSION_TTL_DAYS = 30;

function newToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function getSession(req: Request): string | null {
  return (req.cookies as Record<string, string>)?.[SESSION_COOKIE] ?? null;
}

async function resolveEmail(sessionToken: string): Promise<string | null> {
  const now = new Date();
  const rows = await db
    .select()
    .from(myReportsSessionsTable)
    .where(
      and(
        eq(myReportsSessionsTable.token, sessionToken),
        gt(myReportsSessionsTable.expiresAt, now)
      )
    )
    .limit(1);
  return rows[0]?.email ?? null;
}

// ── POST /api/my-reports/request ──────────────────────────────────────────────
// Creates a magic-link token. In development returns `devToken`; in production
// sends email via Resend (requires RESEND_API_KEY).

const RequestBody = z.object({
  email: z.string().email().max(254),
});

router.post("/request", async (req, res) => {
  const parsed = RequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid email address." });
    return;
  }

  const { email } = parsed.data;
  const token = newToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000);

  await db.insert(magicLinkTokensTable).values({ token, email, expiresAt });

  req.log.info({ email }, "magic_link_requested");

  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    res.json({
      ok: true,
      devToken: token,
    });
    return;
  }

  if (!isResendConfigured()) {
    await db
      .delete(magicLinkTokensTable)
      .where(eq(magicLinkTokensTable.token, token));
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
      .where(eq(magicLinkTokensTable.token, token));
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
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: "Missing token." });
    return;
  }

  const now = new Date();
  const rows = await db
    .select()
    .from(magicLinkTokensTable)
    .where(
      and(
        eq(magicLinkTokensTable.token, token),
        isNull(magicLinkTokensTable.usedAt),
        gt(magicLinkTokensTable.expiresAt, now)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    res.status(401).json({ error: "Invalid or expired magic link." });
    return;
  }

  const { email } = rows[0];

  // Mark token used
  await db
    .update(magicLinkTokensTable)
    .set({ usedAt: now })
    .where(eq(magicLinkTokensTable.token, token));

  // Create session
  const sessionToken = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(myReportsSessionsTable).values({ token: sessionToken, email, expiresAt });

  req.log.info({ email }, "my_reports_session_created");

  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  // Redirect to my-reports page (frontend route)
  const base = process.env.BASE_PATH ?? "";
  res.redirect(`${base}/my-reports?verified=1`);
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
    // fixing the previous N+1 query pattern and the bug where only the first
    // report's habit score was fetched.
    reports = await db
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
          isNotNull(reportsTable.claimed)
        )
      )
      .orderBy(reportsTable.createdAt);
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
    await db
      .delete(myReportsSessionsTable)
      .where(eq(myReportsSessionsTable.token, sessionToken))
      .catch(() => {});
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
