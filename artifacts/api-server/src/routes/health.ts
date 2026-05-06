import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Health check with actual DB connectivity test (#11) ───────────────────────
// Returns 503 if database is unreachable so load balancers route traffic away.
router.get("/healthz", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", db: "unreachable" });
  }
});

export default router;
