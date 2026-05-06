import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

interface FeedEvent {
  id: number;
  ts: string;
  component: string;
  message: string;
  value: string;
  level: "ok" | "warn" | "info" | "alert";
}

const EVENT_POOL: Omit<FeedEvent, "id" | "ts">[] = [
  { component: "BATTERY",  message: "Capacity reading",              value: "67,241 mWh",   level: "ok"    },
  { component: "CPU",      message: "Idle temperature",              value: "69°C",         level: "warn"  },
  { component: "SSD",      message: "SMART self-test",               value: "PASS",         level: "ok"    },
  { component: "RAM",      message: "Memory usage",                  value: "43%",          level: "ok"    },
  { component: "THERMALS", message: "Throttle event detected",       value: "94°C peak",    level: "alert" },
  { component: "NETWORK",  message: "DNS resolution",                value: "14 ms",        level: "ok"    },
  { component: "GPU",      message: "Driver stability check",        value: "0 TDR events", level: "ok"    },
  { component: "BATTERY",  message: "Discharge rate",                value: "-8.3 W",       level: "ok"    },
  { component: "CPU",      message: "Boost clock duration",          value: "22 s avg",     level: "info"  },
  { component: "SSD",      message: "Write endurance used",          value: "12%",          level: "ok"    },
  { component: "STARTUP",  message: "Boot duration",                 value: "11.2 s",       level: "ok"    },
  { component: "BATTERY",  message: "Cycle count",                   value: "412",          level: "warn"  },
  { component: "ANALYSIS", message: "Baseline updated",              value: "14-day window",level: "info"  },
  { component: "RAM",      message: "Page fault rate",               value: "0.4 /s",       level: "ok"    },
  { component: "THERMALS", message: "Vent airflow pattern",          value: "nominal",      level: "ok"    },
  { component: "ANALYSIS", message: "Anomaly score",                 value: "LOW",          level: "ok"    },
  { component: "BATTERY",  message: "Degradation rate",              value: "3× expected",  level: "alert" },
  { component: "SSD",      message: "Free space",                    value: "9.2% — low",   level: "warn"  },
  { component: "NETWORK",  message: "Packet loss",                   value: "0.0%",         level: "ok"    },
  { component: "CPU",      message: "Frequency scaling",             value: "healthy",      level: "ok"    },
  { component: "ANALYSIS", message: "Cross-component correlation",   value: "heat + batt",  level: "warn"  },
  { component: "DRIVERS",  message: "BIOS firmware age",             value: "14 months",    level: "info"  },
  { component: "GPU",      message: "Temperature at load",           value: "71°C",         level: "ok"    },
  { component: "RAM",      message: "ECC errors",                    value: "0",            level: "ok"    },
  { component: "ANALYSIS", message: "Weekly report generated",       value: "score 79/100", level: "info"  },
];

const LEVEL_STYLES: Record<FeedEvent["level"], { dot: string; badge: string; text: string }> = {
  ok:    { dot: "bg-green-400",  badge: "text-green-400/70 border-green-400/20",   text: "text-green-400"  },
  warn:  { dot: "bg-amber-400",  badge: "text-amber-400/70 border-amber-400/20",   text: "text-amber-400"  },
  info:  { dot: "bg-cyan-400",   badge: "text-cyan-400/70 border-cyan-400/20",     text: "text-cyan-400"   },
  alert: { dot: "bg-red-400",    badge: "text-red-400/70 border-red-400/20",       text: "text-red-400"    },
};

function formatTs(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function pickNext(last: number): number {
  let next = Math.floor(Math.random() * EVENT_POOL.length);
  while (next === last) next = Math.floor(Math.random() * EVENT_POOL.length);
  return next;
}

let globalId = 1;

function seedFeed(): FeedEvent[] {
  const now = new Date();
  const seeds: FeedEvent[] = [];
  const used = new Set<number>();
  for (let i = 0; i < 8; i++) {
    let idx = Math.floor(Math.random() * EVENT_POOL.length);
    while (used.has(idx)) idx = (idx + 1) % EVENT_POOL.length;
    used.add(idx);
    const d = new Date(now.getTime() - (8 - i) * 4500);
    seeds.push({ id: globalId++, ts: formatTs(d), ...EVENT_POOL[idx] });
  }
  return seeds;
}

export default function HealthFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(() => seedFeed());
  const [tick, setTick] = useState(0);
  const lastIdxRef = useRef(-1);

  // Add a new event every ~3.5 s
  useEffect(() => {
    const interval = setInterval(() => {
      const idx = pickNext(lastIdxRef.current);
      lastIdxRef.current = idx;
      const e: FeedEvent = {
        id: globalId++,
        ts: formatTs(new Date()),
        ...EVENT_POOL[idx],
      };
      setEvents((prev) => [e, ...prev].slice(0, 12));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Tick counter for the "uptime" display
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const uptimeHrs  = Math.floor((tick + 28800) / 3600);
  const uptimeMins = Math.floor(((tick + 28800) % 3600) / 60);
  const uptimeSecs = (tick + 28800) % 60;

  return (
    <section className="px-6 py-20 border-y border-border/60 bg-card/10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">

          {/* Left copy */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-24">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse" />
              LIVE MONITORING
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              Sentinel never stops watching.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Every few minutes — silently, locally — Sentinel reads from over 60 hardware telemetry points. It compares each reading to your personal baseline, scores any drift, and cross-references related metrics for early pattern detection.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You don't see any of this. You only hear from Sentinel when something actually needs your attention.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              {[
                { label: "Checks per day",    value: "860+" },
                { label: "Avg CPU overhead",  value: "< 1%" },
                { label: "Network calls",     value: "Zero" },
              ].map((s) => (
                <div key={s.label} className="surface-card rounded-lg px-4 py-3 text-center">
                  <div className="text-lg font-bold font-mono text-primary">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              How Sentinel learns your baseline <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Right feed */}
          <div className="rounded-xl border border-border/60 bg-[#0a0e1a] overflow-hidden shadow-2xl">
            {/* Feed header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-[#0d1220]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">sentinel — telemetry feed (simulation)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground">
                  {String(uptimeHrs).padStart(2, "0")}:{String(uptimeMins).padStart(2, "0")}:{String(uptimeSecs).padStart(2, "0")}
                </span>
              </div>
            </div>

            {/* Events */}
            <div className="divide-y divide-border/20 overflow-hidden">
              {events.map((ev, i) => {
                const s = LEVEL_STYLES[ev.level];
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-all duration-500"
                    style={{
                      opacity: i === 0 ? 1 : Math.max(0.25, 1 - i * 0.08),
                      background: i === 0 ? "rgba(34,211,238,0.03)" : "transparent",
                    }}
                  >
                    <span className="text-xs font-mono text-muted-foreground/40 w-20 shrink-0 tabular-nums">
                      {ev.ts}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot} ${i === 0 ? "animate-pulse" : ""}`} />
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border shrink-0 ${s.badge}`}>
                      {ev.component}
                    </span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{ev.message}</span>
                    <span className={`text-xs font-mono shrink-0 ${s.text}`}>{ev.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Feed footer */}
            <div className="px-4 py-2.5 border-t border-border/40 bg-[#0d1220] flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground/50">
                {events.length} events in buffer
              </span>
              <span className="text-xs font-mono text-green-400/60">● all systems nominal</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
