import { type Response } from "express";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql, isNull, gte, and } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveStats {
  totalReports: number;
  reportsLast24h: number;
  reportsLast7d: number;
  avgBatteryHealth: number | null;
  avgOverallScore: number | null;
  gradeDistribution: Record<string, number>;
  osBreakdown: Record<string, number>;
  updatedAt: string;
}

export interface LiveFeedEvent {
  id: string;
  model: string;
  grade: string;
  overallScore: number;
  os: string;
  batteryHealth: number | null;
  timestamp: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

const clients = new Set<Response>();

let cachedStats: LiveStats | null = null;
let statsLastFetched = 0;
const STATS_TTL_MS = 30_000;

const recentEvents: LiveFeedEvent[] = [];
const MAX_FEED_SIZE = 50;

// ── DB init ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: NodePgDatabase<any> | null = null;
let _reportsTable: unknown = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function initLiveFeed(db: NodePgDatabase<any>, reportsTable: unknown) {
  _db = db;
  _reportsTable = reportsTable;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function normalizeOs(raw: string): string {
  if (!raw) return "";
  const r = raw.toLowerCase();
  if (r.includes("windows 11")) return "Windows 11";
  if (r.includes("windows 10")) return "Windows 10";
  if (r.includes("windows 8")) return "Windows 8";
  if (r.includes("windows 7")) return "Windows 7";
  if (r.includes("windows")) return "Windows";
  if (r.includes("mac")) return "macOS";
  if (r.includes("linux")) return "Linux";
  return "Other";
}

async function fetchFreshStats(): Promise<LiveStats> {
  if (!_db) return emptyStats();

  try {
    const now = new Date();
    const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const ago7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Single query for totals + avg score
    const totalResult = await _db.execute<{
      total: string;
      last24h: string;
      last7d: string;
      avg_score: string | null;
    }>(sql`
      SELECT
        COUNT(*)::int                                                          AS total,
        COUNT(*) FILTER (WHERE created_at >= ${ago24h.toISOString()}::timestamptz)::int AS last24h,
        COUNT(*) FILTER (WHERE created_at >= ${ago7d.toISOString()}::timestamptz)::int  AS last7d,
        ROUND(AVG((result_json->>'overall')::numeric)::numeric, 1)            AS avg_score
      FROM reports
      WHERE deleted_at IS NULL
    `);
    const totalRows = Array.isArray(totalResult) ? totalResult : totalResult.rows;
    const totalRow = totalRows[0];

    // Sample recent rows for distribution data (last 7d, max 500)
    const rowsResult = await _db.execute<{
      grade: string | null;
      os: string | null;
      battery_health: string | null;
    }>(sql`
      SELECT
        result_json->>'grade'                          AS grade,
        raw_json->'system'->>'os'                      AS os,
        (raw_json->'battery'->>'health')::text         AS battery_health
      FROM reports
      WHERE deleted_at IS NULL
        AND created_at >= ${ago7d.toISOString()}::timestamptz
      ORDER BY created_at DESC
      LIMIT 500
    `);
    const rows = Array.isArray(rowsResult) ? rowsResult : rowsResult.rows;

    const gradeDistribution: Record<string, number> = {};
    const osBreakdown: Record<string, number> = {};
    let totalBattery = 0;
    let batteryCount = 0;

    for (const r of rows) {
      if (r.grade) {
        const g = r.grade.trim().toUpperCase();
        gradeDistribution[g] = (gradeDistribution[g] ?? 0) + 1;
      }

      const os = normalizeOs(r.os ?? "");
      if (os) osBreakdown[os] = (osBreakdown[os] ?? 0) + 1;

      const bh = parseFloat(r.battery_health ?? "");
      if (!isNaN(bh) && bh > 0 && bh <= 100) {
        totalBattery += bh;
        batteryCount++;
      }
    }

    return {
      totalReports:     Number(totalRow.total    ?? 0),
      reportsLast24h:   Number(totalRow.last24h  ?? 0),
      reportsLast7d:    Number(totalRow.last7d   ?? 0),
      avgOverallScore:  totalRow.avg_score != null ? Number(totalRow.avg_score) : null,
      avgBatteryHealth: batteryCount > 0
        ? Math.round((totalBattery / batteryCount) * 10) / 10
        : null,
      gradeDistribution,
      osBreakdown,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[liveFeed] fetchFreshStats error:", err);
    return emptyStats();
  }
}

function emptyStats(): LiveStats {
  return {
    totalReports: 0,
    reportsLast24h: 0,
    reportsLast7d: 0,
    avgBatteryHealth: null,
    avgOverallScore: null,
    gradeDistribution: {},
    osBreakdown: {},
    updatedAt: new Date().toISOString(),
  };
}

export async function getStats(forceRefresh = false): Promise<LiveStats> {
  const now = Date.now();
  if (!forceRefresh && cachedStats && now - statsLastFetched < STATS_TTL_MS) {
    return cachedStats;
  }
  cachedStats = await fetchFreshStats();
  statsLastFetched = now;
  return cachedStats;
}

// ── Client management ─────────────────────────────────────────────────────────

export function addClient(res: Response) {
  clients.add(res);
  res.on("close", () => clients.delete(res));
}

function sendToClient(res: Response, event: string, data: unknown) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    clients.delete(res);
  }
}

function broadcast(event: string, data: unknown) {
  for (const client of clients) {
    sendToClient(client, event, data);
  }
}

// ── Emit new report ───────────────────────────────────────────────────────────

export function emitNewReport(event: LiveFeedEvent) {
  recentEvents.unshift(event);
  if (recentEvents.length > MAX_FEED_SIZE) recentEvents.length = MAX_FEED_SIZE;

  // Invalidate cache
  cachedStats = null;

  // Broadcast the new event immediately
  broadcast("new_report", event);

  // Broadcast refreshed stats shortly after (let DB write settle)
  setTimeout(async () => {
    const stats = await getStats(true);
    broadcast("stats", stats);
  }, 600);
}

export function getRecentEvents(): LiveFeedEvent[] {
  return [...recentEvents];
}

// ── Heartbeat / periodic stats push ──────────────────────────────────────────

setInterval(async () => {
  if (clients.size === 0) return;
  const stats = await getStats();
  broadcast("stats", stats);
  for (const client of clients) {
    try { client.write(": heartbeat\n\n"); } catch { clients.delete(client); }
  }
}, 30_000);
