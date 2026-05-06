import { PgBoss } from "pg-boss";
import { logger } from "../logger";
import { pool } from "@workspace/db";
import { isResendConfigured } from "../email/config";
import { buildReportClaimedEmail } from "../email/templates/reportClaimed";
import { sendTransactionalEmail } from "../email/resendMailer";
import { emitNewReport } from "../liveFeed";

// Initialize pg-boss using the existing database pool or connection string.
// Since we have a connection string in process.env.DATABASE_URL, we'll use that.
let boss: PgBoss | null = null;

export async function initQueue() {
  if (!process.env.DATABASE_URL) {
    logger.warn("DATABASE_URL not set. Background queue will not be initialized.");
    return;
  }

  boss = new PgBoss(process.env.DATABASE_URL);

  boss.on("error", (error: any) => logger.error({ error }, "pg-boss error"));

  await boss.start();
  logger.info("Background queue started successfully");

  // Ensure queues exist (required in pg-boss v10+ strict mode)
  await boss.createQueue("send-claim-email");
  await boss.createQueue("emit-live-feed");

  // Define workers
  await boss.work("send-claim-email", async (job: any) => {
    const { email, reportId } = job.data as { email: string; reportId: string };
    if (!isResendConfigured()) {
      logger.warn(`Resend is not configured, skipping claim email for ${reportId}`);
      return;
    }
    const { subject, html, text } = buildReportClaimedEmail(email, reportId);
    await sendTransactionalEmail({ to: email, subject, html, text });
  });

  await boss.work("emit-live-feed", async (job: any) => {
    const data = job.data as any;
    emitNewReport(data);
  });
}

export async function stopQueue() {
  if (boss) {
    await boss.stop();
  }
}

export async function enqueueClaimEmail(email: string, reportId: string) {
  if (boss) {
    await boss.send("send-claim-email", { email, reportId }, { retryLimit: 3, expireInSeconds: 60 * 5 });
  }
}

export async function enqueueLiveFeed(data: any) {
  if (boss) {
    await boss.send("emit-live-feed", data, { retryLimit: 1 }); // Less critical, only retry once
  }
}
