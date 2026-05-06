import { useEffect, useRef, useState, useCallback } from "react";

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

export type ConnectionMode = "sse" | "polling" | "connecting" | "offline";

interface UseLiveFeedReturn {
  stats: LiveStats | null;
  feed: LiveFeedEvent[];
  mode: ConnectionMode;
  lastUpdate: Date | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const STATS_URL = `${API_BASE}/api/live/stats`;
const STREAM_URL = `${API_BASE}/api/live/stream`;
const POLL_INTERVAL_MS = 5_000;
const MAX_FEED_SIZE = 30;
const SSE_RETRY_DELAY_MS = 8_000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveFeed(): UseLiveFeedReturn {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [feed, setFeed] = useState<LiveFeedEvent[]>([]);
  const [mode, setMode] = useState<ConnectionMode>("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const addEvent = useCallback((event: LiveFeedEvent) => {
    setFeed((prev) => {
      const already = prev.some((e) => e.id === event.id);
      if (already) return prev;
      return [event, ...prev].slice(0, MAX_FEED_SIZE);
    });
  }, []);

  const applyStats = useCallback((data: LiveStats & { recentEvents?: LiveFeedEvent[] }) => {
    if (!mountedRef.current) return;
    setStats(data);
    setLastUpdate(new Date());
    if (data.recentEvents) {
      setFeed((prev) => {
        const merged = [...data.recentEvents!, ...prev];
        const seen = new Set<string>();
        return merged.filter((e) => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        }).slice(0, MAX_FEED_SIZE);
      });
    }
  }, []);

  // ── Polling fallback ──────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setMode("polling");

    const poll = async () => {
      try {
        const res = await fetch(STATS_URL, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          applyStats(data);
        }
      } catch { /* offline */ }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [applyStats]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── SSE connection ─────────────────────────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setMode("connecting");
    const es = new EventSource(STREAM_URL);
    esRef.current = es;

    es.addEventListener("stats", (e) => {
      if (!mountedRef.current) return;
      try {
        applyStats(JSON.parse(e.data));
        setMode("sse");
        stopPolling();
      } catch {}
    });

    es.addEventListener("init", (e) => {
      if (!mountedRef.current) return;
      try {
        const data: { recentEvents?: LiveFeedEvent[] } = JSON.parse(e.data);
        if (data.recentEvents) {
          setFeed((prev) => {
            const merged = [...(data.recentEvents ?? []), ...prev];
            const seen = new Set<string>();
            return merged.filter((e) => {
              if (seen.has(e.id)) return false;
              seen.add(e.id);
              return true;
            }).slice(0, MAX_FEED_SIZE);
          });
        }
      } catch {}
    });

    es.addEventListener("new_report", (e) => {
      if (!mountedRef.current) return;
      try {
        addEvent(JSON.parse(e.data));
        setLastUpdate(new Date());
      } catch {}
    });

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      esRef.current = null;
      setMode("polling");
      startPolling();
      // Try SSE again after a delay
      setTimeout(() => {
        if (mountedRef.current && mode !== "sse") connectSSE();
      }, SSE_RETRY_DELAY_MS);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addEvent, applyStats, startPolling, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;

    // Try SSE first; if EventSource isn't supported, fall back to polling
    if (typeof EventSource !== "undefined") {
      connectSSE();
    } else {
      startPolling();
    }

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { stats, feed, mode, lastUpdate };
}
