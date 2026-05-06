import { Router } from "express";
import { db, reportsTable } from "@workspace/db";
import { addClient, getStats, getRecentEvents, initLiveFeed } from "../lib/liveFeed";

// Initialise live feed with DB (once on first import)
initLiveFeed(db, reportsTable);

const router = Router();

// ── GET /api/live/stats ───────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  try {
    const stats = await getStats();
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      ...stats,
      recentEvents: getRecentEvents().slice(0, 20),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch live stats" });
  }
});

// ── GET /api/live/stream ──────────────────────────────────────────────────────

router.get("/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Send initial payload immediately
  try {
    const stats = await getStats();
    const events = getRecentEvents().slice(0, 20);
    res.write(`event: stats\ndata: ${JSON.stringify(stats)}\n\n`);
    res.write(`event: init\ndata: ${JSON.stringify({ recentEvents: events })}\n\n`);
  } catch {
    // non-fatal — client will receive next broadcast
  }

  addClient(res);

  req.on("close", () => {
    res.end();
  });
});

export default router;
