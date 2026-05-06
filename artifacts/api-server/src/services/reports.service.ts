import { db, reportsTable, reportPayloadsTable, idempotencyKeysTable, reportHabitAnswersTable, devicesTable, usersTable } from "@workspace/db";
import { SentinelReportSchema, generateReport, computeHabitScore, combinedScore } from "@workspace/report-engine";
import { eq, and, isNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import crypto from "node:crypto";
import { newClaimToken, newShareToken, sha256hex } from "../lib/ids";
import { consumeRateLimit } from "../lib/rateLimit";
import { enqueueClaimEmail, enqueueLiveFeed } from "../lib/queue";
import pino from "pino";

// A dummy logger for service use if req.log isn't passed (though passing it is better)
const defaultLogger = pino();

export class ReportsService {
  /**
   * Processes a new report payload, validates it, checks rate limits/idempotency,
   * generates the report using the engine, and persists it to the database using CUID2.
   */
  static async createReport(
    payload: { rawJson: any; habitAnswers?: Record<string, number>; legacy?: boolean },
    ip: string,
    idempotencyKey?: string,
    deviceToken?: string,
    logger: pino.Logger = defaultLogger
  ) {
    const { rawJson, habitAnswers, legacy } = payload;

    // 1. Device Token Auth
    let agentDeviceOrgId: string | null = null;
    if (deviceToken && deviceToken.length >= 10) {
      const deviceRows = await db
        .select()
        .from(devicesTable)
        .where(eq(devicesTable.deviceToken, deviceToken))
        .limit(1);
      if (deviceRows.length === 0) {
        throw new Error("Invalid device token");
      }
      agentDeviceOrgId = deviceRows[0].orgId ?? null;
    }

    // 2. Validate rawJson
    const reportParsed = SentinelReportSchema.safeParse(rawJson);
    if (!reportParsed.success) {
      const first = reportParsed.error.issues[0];
      throw new Error(`Invalid report data: ${first.path.join(".")}: ${first.message}`);
    }

    // 3. Rate Limiting
    const ipHash = await sha256hex(ip);
    const [perMinute, perDay] = await Promise.all([
      consumeRateLimit(ipHash, 1, 10),
      consumeRateLimit(ipHash, 1440, 100),
    ]);
    if (!perMinute || !perDay) {
      throw new Error("Rate limit exceeded");
    }

    // 4. Idempotency Check
    if (idempotencyKey) {
      const existing = await db
        .select()
        .from(idempotencyKeysTable)
        .where(eq(idempotencyKeysTable.key, idempotencyKey))
        .limit(1);
      if (existing.length > 0) {
        const report = await db
          .select()
          .from(reportsTable)
          .where(eq(reportsTable.id, existing[0].reportId))
          .limit(1);
        if (report.length > 0) {
          const payloadRow = await db
            .select()
            .from(reportPayloadsTable)
            .where(eq(reportPayloadsTable.reportId, report[0].id))
            .limit(1);
          return {
            id: report[0].id,
            claimToken: report[0].claimToken,
            result: payloadRow[0]?.resultJson,
            deduplicated: true,
          };
        }
      }
    }

    // 5. Generate Report
    const resultJson = generateReport(reportParsed.data);
    const habitScore = habitAnswers ? computeHabitScore(habitAnswers) : null;
    const combined = habitScore !== null ? combinedScore(resultJson.overall, habitScore) : null;

    // 6. Persist to DB using CUID2 (No retries needed for collisions)
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

      if (idempotencyKey) {
        await tx.insert(idempotencyKeysTable)
          .values({ key: idempotencyKey, reportId: id })
          .onConflictDoNothing();
      }
    });

    logger.info({ reportId: id, hasHabit: !!habitAnswers }, "report_created");

    // 7. Enqueue Live Feed Emission (Background Job)
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
  static async claimReport(id: string, claimToken: string, email?: string, logger: pino.Logger = defaultLogger) {
    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt))).limit(1);
    if (rows.length === 0) throw new Error("Report not found");
    const row = rows[0];

    if (row.claimToken !== claimToken) throw new Error("Invalid claim token");

    if (row.claimed && !email) return { id, claimed: true, email: row.userId ? "***" : null };

    let finalUserId = row.userId;

    if (email && !finalUserId) {
      const userRows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (userRows.length > 0) {
        finalUserId = userRows[0].id;
      } else {
        finalUserId = crypto.randomBytes(16).toString("hex");
        try {
          await db.insert(usersTable).values({ id: finalUserId, email });
        } catch (err) {
          const concurrentUserRows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
          if (concurrentUserRows.length > 0) {
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
    }).where(eq(reportsTable.id, id));

    logger.info({ reportId: id, hasEmail: !!email }, "report_claimed");

    if (email) {
      enqueueClaimEmail(email, id).catch((e) => logger.error({ err: e }, "Failed to enqueue claim email"));
    }

    return { id, claimed: true, email: email ? "***" : null };
  }

  static async submitHabitAnswers(id: string, claimToken: string, habitAnswers: Record<string, number>, logger: pino.Logger = defaultLogger) {
    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt))).limit(1);
    if (rows.length === 0) throw new Error("Report not found");
    const row = rows[0];

    if (row.claimToken !== claimToken) throw new Error("Invalid claim token");

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
    if (rows.length === 0) throw new Error("Report not found");
    const row = rows[0];

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
      shareToken: row.shareToken ?? null,
      createdAt: row.createdAt,
    };
  }

  static async generateShareToken(id: string, claimToken: string, logger: pino.Logger = defaultLogger) {
    const rows = await db.select().from(reportsTable).where(and(eq(reportsTable.id, id), isNull(reportsTable.deletedAt))).limit(1);
    if (rows.length === 0) throw new Error("Report not found");
    const row = rows[0];

    if (row.claimToken !== claimToken) throw new Error("Invalid claim token");

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
    if (rows.length === 0) throw new Error("Report not found");
    const row = rows[0];

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
