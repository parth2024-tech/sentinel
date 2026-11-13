import { type Response } from "express";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { createDedicatedClient, withSystemScope } from "@workspace/db";
import crypto from "node:crypto";

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

const INSTANCE_ID = crypto.randomUUID();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let listenerClient: any = null;
let isShuttingDown = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;

const clients = new Set<Response>();
const fleetClients = new Map<string, Set<Response>>();
const activeIpCounts = new Map<string, number>();
const MAX_GLOBAL_SSE_CLIENTS = 1000;
const MAX_CONCURRENT_PER_IP = 3;

export function getActiveIpCount(ipHash: string): number {
  return activeIpCounts.get(ipHash) ?? 0;
}

let cachedStats: LiveStats | null = null;
let statsLastFetched = 0;
const STATS_TTL_MS = 30_000;
let inflightStatsPromise: Promise<LiveStats> | null = null;
let statsBroadcastTimer: NodeJS.Timeout | null = null;

const recentEvents: LiveFeedEvent[] = [];
const MAX_FEED_SIZE = 50;

// ── DB init & Resilient Postgres LISTEN/NOTIFY Fan-Out ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: NodePgDatabase<any> | null = null;

async function connectPgListener() {
  if (isShuttingDown || !process.env.DATABASE_URL) return;

  try {
    const client = createDedicatedClient();
    await client.connect();
    await client.query("LISTEN sentinel_live_events");

    listenerClient = client;
    reconnectAttempts = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.on("notification", (msg: any) => {
      if (msg.channel === "sentinel_live_events" && msg.payload) {
        try {
          const event = JSON.parse(msg.payload);
          // Skip echo from this process instance
          if (event.instanceId === INSTANCE_ID) return;

          if (event.type === "new_report" && event.data) {
            recentEvents.unshift(event.data);
            if (recentEvents.length > MAX_FEED_SIZE) recentEvents.length = MAX_FEED_SIZE;
            cachedStats = null;
            broadcast("new_report", event.data);
          } else if (event.type === "fleet_delta" && event.orgId && event.data) {
            const orgSet = fleetClients.get(event.orgId);
            if (orgSet && orgSet.size > 0) {
              for (const c of orgSet) {
                sendToClient(c, "fleet_delta", event.data);
              }
            }
          } else if (event.type === "fleet_delta_ref" && event.orgId) {
            const orgSet = fleetClients.get(event.orgId);
            if (orgSet && orgSet.size > 0) {
              for (const c of orgSet) {
                sendToClient(c, "fleet_delta_ref", { orgId: event.orgId, reportId: event.reportId });
              }
            }
          }
        } catch {
          // Ignore corrupted payload
        }
      }
    });

    const handleDisconnect = () => {
      if (listenerClient === client) {
        listenerClient = null;
      }
      try {
        client.end().catch(() => {});
      } catch {
        // ignore
      }
      scheduleReconnect();
    };

    client.on("error", handleDisconnect);
    client.on("end", handleDisconnect);
  } catch {
    listenerClient = null;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (isShuttingDown || reconnectTimer || !process.env.DATABASE_URL) return;

  reconnectAttempts++;
  // Exponential backoff: 1s, 2s, 4s, 8s, up to 30s + random jitter
  const baseDelay = Math.min(30_000, 1000 * Math.pow(2, Math.max(0, reconnectAttempts - 1)));
  const jitter = Math.floor(Math.random() * 1000);
  const delay = baseDelay + jitter;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectPgListener().catch(() => {});
  }, delay);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initLiveFeed(db: NodePgDatabase<any>) {
  _db = db;
  if (!listenerClient && process.env.DATABASE_URL) {
    await connectPgListener();
  }
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

function sanitizeText(str: unknown, maxLen = 64): string {
  if (typeof str !== "string") return "";
  return str.replace(/[<>&"']/g, "").slice(0, maxLen).trim();
}

async function fetchFreshStats(): Promise<LiveStats> {
  if (!_db) return emptyStats();

  try {
    return await withSystemScope(async (tx) => {
      const now = new Date();
      const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const ago7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Single query for totals + avg score using materialized columns on reportsTable
      const totalResult = await tx.execute<{
        total: string;
        last24h: string;
        last7d: string;
        avg_score: string | null;
      }>(sql`
        SELECT
          COUNT(*)::int                                                                    AS total,
          COUNT(*) FILTER (WHERE r.created_at >= ${ago24h.toISOString()}::timestamptz)::int AS last24h,
          COUNT(*) FILTER (WHERE r.created_at >= ${ago7d.toISOString()}::timestamptz)::int  AS last7d,
          ROUND(AVG(COALESCE(r.overall_score, (rp.result_json->>'overall')::numeric))::numeric, 1) AS avg_score
        FROM reports r
        LEFT JOIN report_payloads rp ON rp.report_id = r.id AND r.overall_score IS NULL
        WHERE r.deleted_at IS NULL
      `);
      const totalRows = Array.isArray(totalResult) ? totalResult : totalResult.rows;
      const totalRow = totalRows[0];

      // Sample recent rows for distribution data (last 7d, max 500) using materialized columns
      const rowsResult = await tx.execute<{
        grade: string | null;
        os: string | null;
        battery_health: string | null;
      }>(sql`
        SELECT
          COALESCE(r.grade, rp.result_json->>'grade')                          AS grade,
          COALESCE(r.os, rp.raw_json->'system'->>'os')                         AS os,
          COALESCE(r.battery_health::text, (rp.raw_json->'battery'->>'health')::text) AS battery_health
        FROM reports r
        LEFT JOIN report_payloads rp ON rp.report_id = r.id AND (r.grade IS NULL OR r.os IS NULL)
        WHERE r.deleted_at IS NULL
          AND r.created_at >= ${ago7d.toISOString()}::timestamptz
        ORDER BY r.created_at DESC
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
        totalReports:     Number(totalRow?.total    ?? 0),
        reportsLast24h:   Number(totalRow?.last24h  ?? 0),
        reportsLast7d:    Number(totalRow?.last7d   ?? 0),
        avgOverallScore:  totalRow?.avg_score != null ? Number(totalRow.avg_score) : null,
        avgBatteryHealth: batteryCount > 0
          ? Math.round((totalBattery / batteryCount) * 10) / 10
          : null,
        gradeDistribution,
        osBreakdown,
        updatedAt: new Date().toISOString(),
      };
    });
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
  if (inflightStatsPromise) {
    return inflightStatsPromise;
  }
  inflightStatsPromise = fetchFreshStats()
    .then((stats) => {
      cachedStats = stats;
      statsLastFetched = Date.now();
      return stats;
    })
    .finally(() => {
      inflightStatsPromise = null;
    });
  return inflightStatsPromise;
}

// ── Client management ─────────────────────────────────────────────────────────

export function addClient(res: Response, ipHash?: string): boolean {
  if (clients.size >= MAX_GLOBAL_SSE_CLIENTS) {
    return false;
  }
  if (ipHash) {
    const current = activeIpCounts.get(ipHash) ?? 0;
    if (current >= MAX_CONCURRENT_PER_IP) {
      return false;
    }
    activeIpCounts.set(ipHash, current + 1);
  }

  clients.add(res);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clients.delete(res);
    if (ipHash) {
      const c = activeIpCounts.get(ipHash) ?? 1;
      if (c <= 1) {
        activeIpCounts.delete(ipHash);
      } else {
        activeIpCounts.set(ipHash, c - 1);
      }
    }
  };

  res.on("close", cleanup);
  res.on("error", cleanup);
  return true;
}

export function addFleetClient(res: Response, orgId: string, ipHash?: string): boolean {
  if (ipHash) {
    const current = activeIpCounts.get(ipHash) ?? 0;
    if (current >= MAX_CONCURRENT_PER_IP) {
      return false;
    }
    activeIpCounts.set(ipHash, current + 1);
  }

  let orgSet = fleetClients.get(orgId);
  if (!orgSet) {
    orgSet = new Set<Response>();
    fleetClients.set(orgId, orgSet);
  }
  orgSet.add(res);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    const set = fleetClients.get(orgId);
    if (set) {
      set.delete(res);
      if (set.size === 0) fleetClients.delete(orgId);
    }
    if (ipHash) {
      const c = activeIpCounts.get(ipHash) ?? 1;
      if (c <= 1) {
        activeIpCounts.delete(ipHash);
      } else {
        activeIpCounts.set(ipHash, c - 1);
      }
    }
  };

  res.on("close", cleanup);
  res.on("error", cleanup);
  return true;
}

export function emitFleetDelta(orgId: string, delta: unknown) {
  const orgSet = fleetClients.get(orgId);
  if (orgSet && orgSet.size > 0) {
    for (const client of orgSet) {
      sendToClient(client, "fleet_delta", delta);
    }
  }

  // Cross-instance fanout via Postgres NOTIFY (with 7,500-byte payload limit guard)
  if (_db) {
    let notifyPayload = JSON.stringify({
      type: "fleet_delta",
      orgId,
      data: delta,
      instanceId: INSTANCE_ID,
    });

    if (Buffer.byteLength(notifyPayload, "utf8") >= 7500) {
      // Delta exceeds Postgres 8000-byte NOTIFY ceiling; broadcast lightweight reference pointer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reportId = (delta as any)?.id ?? (delta as any)?.reportId;
      notifyPayload = JSON.stringify({
        type: "fleet_delta_ref",
        orgId,
        reportId,
        instanceId: INSTANCE_ID,
      });
    }

    _db.execute(sql`SELECT pg_notify('sentinel_live_events', ${notifyPayload})`).catch(() => {});
  }
}

function sendToClient(res: Response, event: string, data: unknown) {
  if (res.writableEnded || res.destroyed) {
    clients.delete(res);
    return;
  }
  if (res.socket && res.socket.writableLength > 64 * 1024) {
    clients.delete(res);
    res.end();
    return;
  }
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
  const sanitized: LiveFeedEvent = {
    id: sanitizeText(event.id, 64),
    model: sanitizeText(event.model, 64) || "Unknown Device",
    grade: sanitizeText(event.grade, 16) || "?",
    overallScore: typeof event.overallScore === "number" && Number.isFinite(event.overallScore) ? Math.max(0, Math.min(100, Math.round(event.overallScore))) : 0,
    os: sanitizeText(event.os, 64) || "Unknown OS",
    batteryHealth: typeof event.batteryHealth === "number" && Number.isFinite(event.batteryHealth) ? Math.max(0, Math.min(100, Math.round(event.batteryHealth))) : null,
    timestamp: typeof event.timestamp === "string" ? event.timestamp : new Date().toISOString(),
  };

  recentEvents.unshift(sanitized);
  if (recentEvents.length > MAX_FEED_SIZE) recentEvents.length = MAX_FEED_SIZE;

  // Invalidate cache
  cachedStats = null;

  // Broadcast the new event immediately to local connections
  broadcast("new_report", sanitized);

  // Cross-instance fanout via Postgres NOTIFY (with 7,500-byte payload limit guard)
  if (_db) {
    const notifyPayload = JSON.stringify({
      type: "new_report",
      data: sanitized,
      instanceId: INSTANCE_ID,
    });
    if (Buffer.byteLength(notifyPayload, "utf8") < 7500) {
      _db.execute(sql`SELECT pg_notify('sentinel_live_events', ${notifyPayload})`).catch(() => {});
    }
  }

  // Debounce refreshed stats broadcast (1000ms delay to let DB write settle)
  if (statsBroadcastTimer) {
    clearTimeout(statsBroadcastTimer);
  }
  statsBroadcastTimer = setTimeout(async () => {
    statsBroadcastTimer = null;
    const stats = await getStats(true);
    broadcast("stats", stats);
  }, 1000);
}

export function getRecentEvents(): LiveFeedEvent[] {
  return [...recentEvents];
}

// ── Heartbeat / periodic stats push ──────────────────────────────────────────

let heartbeatTimer: NodeJS.Timeout | null = setInterval(async () => {
  if (clients.size === 0) return;
  const stats = await getStats();
  broadcast("stats", stats);
  for (const client of clients) {
    try { client.write(": heartbeat\n\n"); } catch { clients.delete(client); }
  }
}, 30_000);

/**
 * Gracefully terminates all active SSE connections and Postgres listener client
 * during process shutdown (SIGTERM/SIGINT) so that httpServer.close() drains in <1s.
 */
export function closeAllStreams(): void {
  isShuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (statsBroadcastTimer) {
    clearTimeout(statsBroadcastTimer);
    statsBroadcastTimer = null;
  }
  for (const client of clients) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write("event: shutdown\ndata: {\"message\":\"Server shutting down\"}\n\n");
        client.end();
      }
    } catch {
      // ignore
    }
  }
  clients.clear();

  for (const orgSet of fleetClients.values()) {
    for (const client of orgSet) {
      try {
        if (!client.writableEnded && !client.destroyed) {
          client.write("event: shutdown\ndata: {\"message\":\"Server shutting down\"}\n\n");
          client.end();
        }
      } catch {
        // ignore
      }
    }
  }
  fleetClients.clear();
  activeIpCounts.clear();

  if (listenerClient) {
    try {
      listenerClient.end().catch(() => {});
    } catch {
      // ignore
    }
    listenerClient = null;
  }
}
