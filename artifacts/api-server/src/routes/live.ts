import { Router, type Request } from "express";
import crypto from "node:crypto";
import { db } from "@workspace/db";
import { addClient, getStats, getRecentEvents, initLiveFeed } from "../lib/liveFeed.js";
import { consumeRateLimit } from "../lib/rateLimit.js";

// Initialise live feed with DB (once on first import)
initLiveFeed(db);

const router = Router();

function getClientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

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
  const ip = getClientIp(req);
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

  // Burst connection rate limit: max 10 connections per minute per IP
  const burstAllowed = await consumeRateLimit(ipHash + ":sse_burst", 1, 10);
  if (!burstAllowed) {
    res.set("Retry-After", "60");
    res.status(429).json({ error: "Too many stream connection attempts. Please slow down." });
    return;
  }

  // Active concurrent connection gauge: max 3 concurrent active streams per IP
  if (!addClient(res, ipHash)) {
    res.status(503).json({ error: "Active stream capacity reached or too many concurrent streams from this IP." });
    return;
  }

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

  req.on("close", () => {
    res.end();
  });
});

export default router;
