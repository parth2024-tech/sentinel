/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, reportsTable, reportPayloadsTable, idempotencyKeysTable, reportHabitAnswersTable, devicesTable, usersTable, suspectPayloadsTable } from "@workspace/db";
import { SentinelReportSchema, generateReport, computeHabitScore, combinedScore, validatePlausibility } from "@workspace/report-engine";
import { eq, and, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import crypto from "node:crypto";
import { newClaimToken, newShareToken, sha256hex } from "../lib/ids.js";
import { consumeRateLimit } from "../lib/rateLimit.js";
import { enqueueClaimEmail, enqueueLiveFeed } from "../lib/queue/index.js";
import { timingSafeEqualStr, canonicalJsonHash, getRequiredServerSecret } from "../lib/crypto.js";
import pino from "pino";

// A dummy logger for service use if req.log isn't passed (though passing it is better)
const defaultLogger = pino();

export class ReportsService {
  /**
   * Processes a new report payload, validates it, checks rate limits/idempotency,
   * generates the report using the engine, and persists it to the database using CUID2.
   */
  static async createReport(
    payload: { rawJson: any; habitAnswers?: Record<string, number> | undefined; legacy?: boolean | undefined },
    ip: string,
    idempotencyKey?: string,
    deviceToken?: string,
    logger: pino.Logger = defaultLogger
  ) {
    const { rawJson, habitAnswers, legacy } = payload;
    const ipHash = await sha256hex(ip);

    // 1. RATE LIMIT FIRST (Before DB lookups, plausibility writes, or CPU work)
    const [perMinute, perDay] = await Promise.all([
      consumeRateLimit(`report:min:${ipHash}`, 1, 10),
      consumeRateLimit(`report:day:${ipHash}`, 1440, 100),
    ]);
    if (!perMinute || !perDay) {
      throw new Error("Rate limit exceeded");
    }

    // 2. Schema Version Negotiation
    const version = Number(rawJson.sentinelSchema || rawJson.schemaVersion);
    const MIN_SUPPORTED_VERSION = 1;
    if (!Number.isInteger(version) || version < MIN_SUPPORTED_VERSION) {
      throw new Error(`UPGRADE_REQUIRED: Agent schema version ${version || "unknown"} is no longer supported. Minimum required: ${MIN_SUPPORTED_VERSION}`);
    }

    // 3. Constant-Time Device Token Auth
    let agentDeviceOrgId: string | null = null;
    if (deviceToken && deviceToken.length >= 10) {
      const deviceRows = await db
        .select()
        .from(devicesTable)
        .where(eq(devicesTable.deviceToken, deviceToken))
        .limit(1);
      const dev = deviceRows[0];
      if (!dev || !timingSafeEqualStr(dev.deviceToken, deviceToken)) {
        throw new Error("Invalid device token");
      }
      agentDeviceOrgId = dev.orgId ?? null;
    }

    // 4. Validate Schema & Rate-Limited Plausibility Quarantine
    const reportParsed = SentinelReportSchema.safeParse(rawJson);
    if (!reportParsed.success) {
      const first = reportParsed.error.issues[0];
      throw new Error(`Invalid report data: ${first ? `${first.path.join(".")}: ${first.message}` : "Validation failed"}`);
    }

    const plausibility = validatePlausibility(reportParsed.data);
    if (!plausibility.valid) {
      const failureReason = plausibility.errors.join("; ");
      const allowQuarantineWrite = await consumeRateLimit(`quarantine:${ipHash}`, 60, 5);
      if (allowQuarantineWrite) {
        await db.insert(suspectPayloadsTable).values({
          id: createId(),
          rawJson: rawJson as any,
          failureReason,
          ipHash,
        }).catch((dbErr) => logger.error({ err: dbErr }, "Failed to write suspect_payloads"));
      }
      throw new Error(`Invalid report data (quarantined): ${failureReason}`);
    }

    // 5. Tenant-Scoped Canonical Idempotency Check
    const serverSecret = getRequiredServerSecret();
    const payloadHash = canonicalJsonHash(rawJson);
    const callerScope = deviceToken ? await sha256hex(deviceToken) : ipHash;
    const computedIdempotencyKey = crypto
      .createHmac("sha256", serverSecret)
      .update(`${callerScope}||${idempotencyKey ?? ""}||${payloadHash}`)
      .digest("hex");

    const existing = await db
      .select()
      .from(idempotencyKeysTable)
      .where(eq(idempotencyKeysTable.key, computedIdempotencyKey))
      .limit(1);
    if (existing.length > 0 && existing[0]) {
      const report = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, existing[0].reportId))
        .limit(1);
      const rep = report[0];
      if (rep) {
        const payloadRow = await db
          .select()
          .from(reportPayloadsTable)
          .where(eq(reportPayloadsTable.reportId, rep.id))
          .limit(1);
        const callerAuthorized = (rep.ipHash && timingSafeEqualStr(rep.ipHash, ipHash)) ||
          (agentDeviceOrgId && rep.orgId && timingSafeEqualStr(rep.orgId, agentDeviceOrgId));
        return {
          id: rep.id,
          claimToken: callerAuthorized ? rep.claimToken : null,
          result: payloadRow[0]?.resultJson,
          deduplicated: true,
        };
      }
    }

    // 6. Generate Report
    const resultJson = generateReport(reportParsed.data);
    const habitScore = habitAnswers ? computeHabitScore(habitAnswers) : null;
    const combined = habitScore !== null ? combinedScore(resultJson.overall, habitScore) : null;

    // 7. Persist to DB using CUID2 (No retries needed for collisions)
    const id = createId();
    const claimToken = newClaimToken();

    await db.transaction(async (tx) => {
      await tx.insert(reportsTable).values({
        id,
        claimToken,
        ipHash,
        legacy: legacy ?? false,
        ...(agentDeviceOrgId ? { claimed: true, orgId: agentDeviceOrgId } : {}),
      });

      await tx.insert(reportPayloadsTable).values({
        reportId: id,
        rawJson,
        resultJson: resultJson as any,
      });

      if (habitAnswers && habitScore !== null && combined !== null) {
        await tx.insert(reportHabitAnswersTable).values({
          reportId: id,
          answers: habitAnswers,
          habitScore,
          combinedScore: combined,
        }).onConflictDoNothing();
      }

      await tx.insert(idempotencyKeysTable)
        .values({ key: computedIdempotencyKey, reportId: id })
        .onConflictDoNothing();
    });

    logger.info({ reportId: id, hasHabit: !!habitAnswers }, "report_created");

    // 8. Enqueue Live Feed Emission (Background Job)
    const raw = reportParsed.data as any;
    enqueueLiveFeed({
      id,
      model: raw.system?.model ?? "Unknown Device",
      grade: String((resultJson as any).grade ?? "?"),
      overallScore: Number((resultJson as any).overall ?? 0),
      os: raw.system?.os ?? "Unknown OS",
      batteryHealth: raw.battery?.health ?? null,
      timestamp: new Date().toISOString(),
    }).catch((e) => logger.error({ err: e }, "Failed to enqueue live feed"));

    return { id, claimToken, result: resultJson, habitScore, combinedScore: combined, deduplicated: false };
  }

  /**
   * Claims a report by token and optionally links to a user email.
   * Enqueues a confirmation email if email is provided.
   */
  static async claimReport(
    id: string,
    claimToken: string,
    email?: string,
    ip: string = "unknown",
    logger: pino.Logger = defaultLogger
  ) {
    const ipHash = await sha256hex(ip);
    const allowAttempt = await consumeRateLimit(`claim-attempt:${ipHash}:${id}`, 15, 10);
    if (!allowAttempt) {
      throw new Error("Rate limit exceeded");
    }

    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt))).limit(1);
    const row = rows[0];
    if (!row) throw new Error("Report not found");

    if (!row.claimToken || !timingSafeEqualStr(row.claimToken, claimToken)) throw new Error("Invalid claim token");

    if (row.claimed) {
      if (row.userId && email) {
        // Locked: already bound to an account, cannot re-bind or hijack
        return { id, claimed: true, email: "***" };
      }
      if (!email) {
        return { id, claimed: true, email: row.userId ? "***" : null };
      }
    }

    let finalUserId = row.userId;

    if (email && !finalUserId) {
      const userRows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (userRows.length > 0 && userRows[0]) {
        finalUserId = userRows[0].id;
      } else {
        finalUserId = crypto.randomBytes(16).toString("hex");
        try {
          await db.insert(usersTable).values({ id: finalUserId, email });
        } catch (err) {
          const concurrentUserRows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
          if (concurrentUserRows.length > 0 && concurrentUserRows[0]) {
            finalUserId = concurrentUserRows[0].id;
          } else {
            throw err;
          }
        }
      }
    }

    await db.update(reportsTable).set({
      claimed: true,
      ...(finalUserId ? { userId: finalUserId } : {}),
      updatedAt: new Date(),
    }).where(eq(reportsTable.id, id));

    logger.info({ reportId: id, hasEmail: !!email }, "report_claimed");

    if (email) {
      const allowEmail = await consumeRateLimit(`claim-email:${id}`, 3600, 3);
      if (allowEmail) {
        enqueueClaimEmail(email, id).catch((e) => logger.error({ err: e }, "Failed to enqueue claim email"));
      }
    }

    return { id, claimed: true, email: email ? "***" : null };
  }

  static async submitHabitAnswers(id: string, claimToken: string, habitAnswers: Record<string, number>, logger: pino.Logger = defaultLogger) {
    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt))).limit(1);
    const row = rows[0];
    if (!row) throw new Error("Report not found");

    if (!row.claimToken || !timingSafeEqualStr(row.claimToken, claimToken)) throw new Error("Invalid claim token");

    // Fetch resultJson from payloads
    const payloadRow = await db.select().from(reportPayloadsTable).where(eq(reportPayloadsTable.reportId, id)).limit(1);
    const rj = payloadRow[0]?.resultJson as any ?? {};

    const habitScore = computeHabitScore(habitAnswers);
    const overall = typeof rj.overall === "number" ? rj.overall : 0;
    const combined = combinedScore(overall, habitScore);

    await db.insert(reportHabitAnswersTable).values({
      reportId: id,
      answers: habitAnswers,
      habitScore,
      combinedScore: combined,
    }).onConflictDoUpdate({
      target: reportHabitAnswersTable.reportId,
      set: {
        answers: habitAnswers,
        habitScore,
        combinedScore: combined,
        updatedAt: new Date(),
      },
    });

    logger.info({ reportId: id }, "report_habit_answers_saved");
    return { id, habitScore, combinedScore: combined };
  }

  static async getReport(id: string) {
    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt))).limit(1);
    const row = rows[0];
    if (!row) throw new Error("Report not found");

    const payloadRow = await db.select().from(reportPayloadsTable).where(eq(reportPayloadsTable.reportId, id)).limit(1);
    
    const habitRows = await db.select().from(reportHabitAnswersTable).where(eq(reportHabitAnswersTable.reportId, id)).limit(1);
    const habit = habitRows[0];

    return {
      id: row.id,
      result: payloadRow[0]?.resultJson ?? {},
      habitScore: habit?.habitScore ?? null,
      combinedScore: habit?.combinedScore ?? null,
      claimed: row.claimed,
      email: row.userId ? "***" : null,
      createdAt: row.createdAt,
    };
  }

  static async generateShareToken(id: string, claimToken: string, logger: pino.Logger = defaultLogger) {
    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt))).limit(1);
    const row = rows[0];
    if (!row) throw new Error("Report not found");

    if (!row.claimToken || !timingSafeEqualStr(row.claimToken, claimToken)) throw new Error("Invalid claim token");

    if (row.shareToken) {
      logger.info({ reportId: id }, "share_token_reused");
      return row.shareToken;
    }

    const shareToken = newShareToken();
    await db.update(reportsTable).set({ shareToken, updatedAt: new Date() }).where(eq(reportsTable.id, id));

    logger.info({ reportId: id }, "share_token_created");
    return shareToken;
  }

  static async getSharedReport(shareToken: string) {
    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.shareToken, shareToken), isNull(reportsTable.deletedAt))).limit(1);
    const row = rows[0];
    if (!row) throw new Error("Report not found");

    const payloadRow = await db.select().from(reportPayloadsTable).where(eq(reportPayloadsTable.reportId, row.id)).limit(1);
    const result = (payloadRow[0]?.resultJson ?? {}) as any;

    const habitRows = await db.select().from(reportHabitAnswersTable).where(eq(reportHabitAnswersTable.reportId, row.id)).limit(1);
    const habit = habitRows[0];

    return {
      id: row.id,
      result: {
        overall: result.overall,
        grade: result.grade,
        gradeLabel: result.gradeLabel,
        components: result.components,
        findings: result.findings,
        predictions: result.predictions,
        system: result.system,
        dataQuality: result.dataQuality,
        algoVersion: result.algoVersion,
        generatedAt: result.generatedAt,
      },
      habitScore: habit?.habitScore ?? null,
      combinedScore: habit?.combinedScore ?? null,
      shared: true,
      createdAt: row.createdAt,
    };
  }
}
