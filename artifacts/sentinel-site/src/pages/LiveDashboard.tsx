import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveFeed, type LiveStats, type LiveFeedEvent } from "@/hooks/useLiveFeed";


// ── Helpers ───────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A": return "text-emerald-400";
    case "B": return "text-cyan-400";
    case "C": return "text-amber-400";
    case "D": return "text-orange-400";
    case "F": return "text-red-400";
    default:  return "text-muted-foreground";
  }
}

function gradeBg(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A": return "bg-emerald-500/20 border-emerald-500/40";
    case "B": return "bg-cyan-500/20 border-cyan-500/40";
    case "C": return "bg-amber-500/20 border-amber-500/40";
    case "D": return "bg-orange-500/20 border-orange-500/40";
    case "F": return "bg-red-500/20 border-red-500/40";
    default:  return "bg-muted/20 border-border";
  }
}

function timeAgo(timestamp: string): string {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 5)  return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    prev.current = value;
    const duration = 900;
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (end - start) * ease);
      if (t < 1) frame.current = requestAnimationFrame(animate);
    };

    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(animate);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [value]);

  return <>{display.toFixed(decimals)}</>;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, unit = "", sublabel, color = "cyan", icon, decimals = 0,
}: {
  label: string;
  value: number | null;
  unit?: string;
  sublabel?: string;
  color?: "cyan" | "emerald" | "amber" | "violet";
  icon: string;
  decimals?: number;
}) {
  const colorMap = {
    cyan:    { glow: "shadow-cyan-500/20",    text: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/30" },
    emerald: { glow: "shadow-emerald-500/20", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
    amber:   { glow: "shadow-amber-500/20",   text: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30" },
    violet:  { glow: "shadow-violet-500/20",  text: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/30" },
  };
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border p-6 backdrop-blur-sm shadow-xl ${c.bg} ${c.glow} overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10"
           style={{ background: `radial-gradient(circle, currentColor, transparent)` }} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {sublabel && (
          <span className="text-xs text-muted-foreground bg-background/40 px-2 py-0.5 rounded-full border border-border/40">
            {sublabel}
          </span>
        )}
      </div>
      <div className={`text-4xl font-bold tracking-tight mb-1 ${c.text}`}>
        {value === null ? (
          <span className="text-muted-foreground text-2xl">—</span>
        ) : (
          <><AnimatedNumber value={value} decimals={decimals} />{unit}</>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
}

// ── Grade Donut ───────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: "#10b981", B: "#22d3ee", C: "#f59e0b", D: "#f97316", F: "#ef4444",
};

function GradeDonut({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((s, v) => s + v, 0);
  if (total === 0) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data yet</div>
  );

  const grades = ["A", "B", "C", "D", "F"];
  let offset = 0;
  const segments: { grade: string; pct: number; offset: number }[] = [];
  for (const g of grades) {
    const count = distribution[g] ?? 0;
    const pct = (count / total) * 100;
    segments.push({ grade: g, pct, offset });
    offset += pct;
  }

  const r = 60;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
          <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="20" />
          {segments.map((s) => s.pct > 0 && (
            <circle
              key={s.grade}
              cx="80" cy="80" r={r}
              fill="none"
              stroke={GRADE_COLORS[s.grade] ?? "#666"}
              strokeWidth="20"
              strokeDasharray={`${(s.pct / 100) * circ} ${circ}`}
              strokeDashoffset={-(s.offset / 100) * circ}
              className="transition-all duration-700"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">scans</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {grades.map((g) => (
          <div key={g} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRADE_COLORS[g] }} />
            <span className="text-xs text-muted-foreground">
              Grade {g} <span className="text-foreground font-medium">{distribution[g] ?? 0}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── OS Bar Chart ──────────────────────────────────────────────────────────────

function OsBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total === 0) return (
    <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">No data yet</div>
  );

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([os, count]) => {
        const pct = (count / total) * 100;
        return (
          <div key={os}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{os}</span>
              <span className="text-foreground font-medium">{count} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Feed Item ────────────────────────────────────────────────────────

function FeedItem({ event, index }: { event: LiveFeedEvent; index: number }) {
  const [age, setAge] = useState(() => timeAgo(event.timestamp));

  useEffect(() => {
    const t = setInterval(() => setAge(timeAgo(event.timestamp)), 5000);
    return () => clearInterval(t);
  }, [event.timestamp]);

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-border/40 hover:border-border/70 transition-colors"
    >
      {/* Grade badge */}
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 ${gradeBg(event.grade)}`}>
        <span className={gradeColor(event.grade)}>{event.grade}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{event.model}</p>
        <p className="text-xs text-muted-foreground truncate">{event.os}</p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-foreground">{event.overallScore}<span className="text-xs text-muted-foreground">/100</span></p>
        <p className="text-xs text-muted-foreground">{age}</p>
      </div>
    </motion.div>
  );
}

// ── Connection Badge ──────────────────────────────────────────────────────────

function ConnectionBadge({ mode }: { mode: string }) {
  if (mode === "sse") return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="text-xs font-medium text-emerald-400">LIVE</span>
    </div>
  );

  if (mode === "polling") return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      <span className="text-xs font-medium text-amber-400">Polling</span>
    </div>
  );

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/20 border border-border/40">
      <span className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
      <span className="text-xs font-medium text-muted-foreground">Connecting…</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LiveDashboard() {
  const { stats, feed, mode, lastUpdate } = useLiveFeed();

  // For the "new report" flash effect
  const [flash, setFlash] = useState(false);
  const prevFeedLength = useRef(0);

  useEffect(() => {
    if (feed.length > prevFeedLength.current && prevFeedLength.current > 0) {
      setFlash(true);
      setTimeout(() => setFlash(false), 800);
    }
    prevFeedLength.current = feed.length;
  }, [feed.length]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ConnectionBadge mode={mode} />
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Updated {timeAgo(lastUpdate.toISOString())}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Live Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time health scan activity across all Sentinel users
            </p>
          </div>

          <Link
            href="/health-test"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-background font-semibold text-sm hover:bg-primary/90 transition-all glow-cyan shrink-0"
          >
            <span>🔬</span> Run Your Scan
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon="🔢"
            label="Total Reports"
            value={stats?.totalReports ?? null}
            color="cyan"
          />
          <StatCard
            icon="📅"
            label="Reports Today"
            value={stats?.reportsLast24h ?? null}
            sublabel="24h"
            color="violet"
          />
          <StatCard
            icon="🔋"
            label="Avg Battery Health"
            value={stats?.avgBatteryHealth ?? null}
            unit="%"
            sublabel="7d avg"
            color="emerald"
            decimals={1}
          />
          <StatCard
            icon="⚡"
            label="Avg Health Score"
            value={stats?.avgOverallScore ?? null}
            unit="/100"
            sublabel="all time"
            color="amber"
            decimals={1}
          />
        </div>

        {/* Charts + Feed row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Grade Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6"
          >
            <h2 className="text-sm font-semibold text-foreground mb-1">Grade Distribution</h2>
            <p className="text-xs text-muted-foreground mb-5">Last 7 days</p>
            <GradeDonut distribution={stats?.gradeDistribution ?? {}} />
          </motion.div>

          {/* OS Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6"
          >
            <h2 className="text-sm font-semibold text-foreground mb-1">OS Breakdown</h2>
            <p className="text-xs text-muted-foreground mb-5">Last 7 days</p>
            <OsBreakdown breakdown={stats?.osBreakdown ?? {}} />
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6"
          >
            <h2 className="text-sm font-semibold text-foreground mb-1">This Week</h2>
            <p className="text-xs text-muted-foreground mb-5">7-day summary</p>

            <div className="space-y-4">
              {[
                { label: "Reports this week", value: stats?.reportsLast7d ?? "—", icon: "📊" },
                { label: "Active users", value: feed.length > 0 ? `${Math.min(feed.length, 50)}+` : "—", icon: "👤" },
                { label: "Live connections", value: mode === "sse" ? "Connected" : "Polling", icon: "📡" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{item.icon}</span> {item.label}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center">
                All data is anonymized. No PII is displayed.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Live Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className={`rounded-2xl border backdrop-blur-sm p-6 transition-all duration-300 ${
            flash ? "border-cyan-400/60 shadow-lg shadow-cyan-500/10" : "border-border/50 bg-card/40"
          }`}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Live Activity Feed</h2>
              <p className="text-xs text-muted-foreground">Most recent health scans — anonymized</p>
            </div>
            {feed.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full border border-border/40">
                {feed.length} scans
              </span>
            )}
          </div>

          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="text-4xl mb-3 animate-bounce">📡</div>
              <p className="text-sm">Waiting for live data…</p>
              <p className="text-xs mt-1">New reports will appear here instantly</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              <AnimatePresence mode="popLayout">
                {feed.map((event, i) => (
                  <FeedItem key={event.id} event={event} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          🔒 All statistics are derived from anonymized, aggregated data. Device models and OS versions only — no personal data is ever displayed.
        </p>
      </div>
    </div>
  );
}
