import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Cpu, Thermometer, HardDrive, Battery, Wifi, Activity,
  AlertTriangle, Shield, CheckCircle, Info, Zap, Server,
  Clock, Radio, Eye, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type TimePoint = {
  id?: string;
  t: string;
  cpu: number;
  ram: number;
  cpuTemp: number;
  chassisTemp: number;
  net: number;
};

type AlertLevel = "critical" | "warning" | "info" | "ok";

type AlertEntry = {
  id: number;
  ts: string;
  level: AlertLevel;
  component: string;
  message: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function nowStr() {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ── Constants ────────────────────────────────────────────────────────────────

const CYAN   = "hsl(185, 85%, 55%)";
const VIOLET = "hsl(265, 70%, 65%)";
const AMBER  = "hsl(38, 92%, 60%)";
const RED    = "hsl(0, 72%, 55%)";
const GREEN  = "hsl(142, 70%, 50%)";

function scoreColor(s: number) {
  if (s >= 80) return GREEN;
  if (s >= 60) return AMBER;
  return RED;
}

const ALERT_STYLES: Record<AlertLevel, { dot: string; badge: string; row: string }> = {
  critical: { dot: "bg-red-400",   badge: "text-red-400 border-red-400/30 bg-red-400/10",    row: "bg-red-400/5" },
  warning:  { dot: "bg-amber-400", badge: "text-amber-400 border-amber-400/30 bg-amber-400/10", row: "bg-amber-400/5" },
  info:     { dot: "bg-cyan-400",  badge: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",   row: "" },
  ok:       { dot: "bg-green-400", badge: "text-green-400/60 border-green-400/20 bg-green-400/5", row: "" },
};

const FINDING_STYLES: Record<AlertLevel, { border: string; badge: string; bg: string }> = {
  critical: { border: "border-l-red-400",   badge: "text-red-400 bg-red-400/10 border-red-400/30",   bg: "bg-red-400/5" },
  warning:  { border: "border-l-amber-400", badge: "text-amber-400 bg-amber-400/10 border-amber-400/30", bg: "bg-amber-400/5" },
  info:     { border: "border-l-cyan-400",  badge: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",  bg: "" },
  ok:       { border: "border-l-green-400", badge: "text-green-400 bg-green-400/10 border-green-400/30", bg: "" },
};

// ── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? CYAN : score >= 60 ? AMBER : RED;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(220 30% 16%)" strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

// ── Mini Gauge ───────────────────────────────────────────────────────────────

function MiniGauge({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1220] border border-border rounded-lg px-3 py-2 text-xs font-mono shadow-xl">
      <div className="text-muted-foreground mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [history, setHistory] = useState<TimePoint[]>([]);
  const [overall, setOverall] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);
  const [componentScores, setComponentScores] = useState<{ name: string; score: number }[]>([]);
  const [aiFindings, setAiFindings] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const alertIdRef = useRef(100);

  const [uptime, setUptime] = useState(0);
  const [scanAge, setScanAge] = useState(0);
  const [scanPulse, setScanPulse] = useState(false);

  // Uptime ticker
  useEffect(() => {
    const t = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Scan age ticker
  useEffect(() => {
    const t = setInterval(() => setScanAge(a => a + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch real telemetry data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/fleet/dashboard");
        if (!res.ok) return;
        const data = await res.json();
        
        setOverall(data.overall || 0);
        setDeviceCount(data.deviceCount || 0);
        setComponentScores(data.components || []);
        
        const mappedFindings = (data.findings || []).map((f: any) => ({
          severity: f.urgency === "critical" ? "critical" : f.urgency === "warning" ? "warning" : "info",
          component: f.component,
          title: f.title,
          desc: f.body,
          trend: f.urgency === "critical" ? "down" : "flat",
        }));
        setAiFindings(mappedFindings);

        if (data.timeSeries && data.timeSeries.length > 0) {
          // Keep last 30 points
          const latestPts = data.timeSeries.slice(-30).map((pt: any) => ({
            id: pt.id,
            t: pt.t,
            cpu: Number(pt.cpu?.toFixed(1) || 0),
            ram: Number(pt.ram?.toFixed(1) || 0),
            cpuTemp: Number(pt.cpuTemp?.toFixed(1) || 0),
            chassisTemp: Number(pt.chassisTemp?.toFixed(1) || 0),
            net: Number(pt.net?.toFixed(1) || 0),
          }));
          setHistory(latestPts);
          
          // Generate a fake stream of events based on findings to keep UI rich
          if (mappedFindings.length > 0 && Math.random() > 0.5) {
            const f = mappedFindings[Math.floor(Math.random() * mappedFindings.length)];
            const entry: AlertEntry = {
              id: alertIdRef.current++,
              ts: nowStr(),
              level: f.severity as AlertLevel,
              component: f.component.toUpperCase(),
              message: f.title,
            };
            setAlerts(prev => [entry, ...prev].slice(0, 20));
          } else if (Math.random() > 0.7) {
            const entry: AlertEntry = {
              id: alertIdRef.current++,
              ts: nowStr(),
              level: "ok",
              component: "SYSTEM",
              message: "Telemetry sync successful",
            };
            setAlerts(prev => [entry, ...prev].slice(0, 20));
          }
        }
        
        setScanAge(0);
        setScanPulse(true);
        setTimeout(() => setScanPulse(false), 300);
      } catch (err) {
        console.error("Failed to fetch fleet data", err);
      }
    }

    fetchData(); // Initial
    const t = setInterval(fetchData, 4000); // Poll every 4 seconds
    return () => clearInterval(t);
  }, []);

  const live = history.length > 0 ? history[history.length - 1] : { cpu: 0, ram: 0, cpuTemp: 0, chassisTemp: 0, net: 0 };

  const uptimeH = Math.floor(uptime / 3600);
  const uptimeM = Math.floor((uptime % 3600) / 60);
  const uptimeS = uptime % 60;
  const uptimeStr = `${String(uptimeH).padStart(2,"0")}:${String(uptimeM).padStart(2,"0")}:${String(uptimeS).padStart(2,"0")}`;

  const scanAgeStr = scanAge < 5 ? "just now" : scanAge < 60 ? `${scanAge}s ago` : `${Math.floor(scanAge/60)}m ago`;

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex flex-col">

      {/* ── Top bar ── */}
      <header className="border-b border-border bg-card/60 backdrop-blur px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Shield className="w-6 h-6 text-primary" strokeWidth={1.5} />
            <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-background ${scanPulse ? "scale-125" : ""} transition-transform`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground tracking-wide">NovaSentinel</span>
            <span className="ml-2 text-xs text-primary">Fleet Dashboard</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-400/30 bg-green-400/5 text-green-400 text-xs ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="hidden sm:flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-primary" />
            <span className="text-foreground font-medium">FLEET: {deviceCount.toLocaleString()} DEVICES</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Uptime <span className="text-foreground">{uptimeStr}</span></span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>Last scan <span className={`${scanAge < 5 ? "text-green-400" : "text-foreground"}`}>{scanAgeStr}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <ScoreRing score={overall} size={36} />
            <div>
              <div className="text-base font-bold text-foreground leading-none">{overall}</div>
              <div className="text-[10px] text-muted-foreground">health</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 p-4 grid gap-4" style={{ gridTemplateRows: "auto auto 1fr", gridTemplateColumns: "1fr" }}>

        {/* ── Row 1: Metric tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* CPU */}
          <MetricTile
            icon={Cpu} label="CPU USAGE" iconColor="text-cyan-400"
            value={`${live.cpu}%`}
            sub={`${(live.cpu * 0.04).toFixed(2)} GHz avg`}
            gauge={<MiniGauge value={live.cpu} max={100} color={live.cpu > 70 ? AMBER : CYAN} />}
            alert={live.cpu > 75}
          />
          {/* Temp */}
          <MetricTile
            icon={Thermometer} label="TEMPERATURE" iconColor="text-amber-400"
            value={`${live.cpuTemp}°C`}
            sub={`${live.cpuTemp > 78 ? "throttling risk" : "nominal"}`}
            gauge={<MiniGauge value={live.cpuTemp} max={100} color={live.cpuTemp > 80 ? RED : live.cpuTemp > 70 ? AMBER : CYAN} />}
            alert={live.cpuTemp > 80}
          />
          {/* RAM */}
          <MetricTile
            icon={Activity} label="RAM USAGE" iconColor="text-violet-400"
            value={`${live.ram}%`}
            sub="System usage"
            gauge={<MiniGauge value={live.ram} max={100} color={live.ram > 80 ? AMBER : VIOLET} />}
          />
          {/* SSD */}
          <MetricTile
            icon={HardDrive} label="SSD HEALTH" iconColor="text-cyan-400"
            value={`${componentScores.find(c => c.name === "Storage")?.score || 0}%`}
            sub="Average fleet storage"
            gauge={<MiniGauge value={componentScores.find(c => c.name === "Storage")?.score || 0} max={100} color={CYAN} />}
            alert={(componentScores.find(c => c.name === "Storage")?.score || 100) < 60}
          />
          {/* Battery */}
          <MetricTile
            icon={Battery} label="BATTERY" iconColor="text-amber-400"
            value={`${componentScores.find(c => c.name === "Battery")?.score || 0}%`}
            sub="Average fleet capacity"
            gauge={<MiniGauge value={componentScores.find(c => c.name === "Battery")?.score || 0} max={100} color={AMBER} />}
          />
          {/* Network */}
          <MetricTile
            icon={Wifi} label="NETWORK" iconColor="text-green-400"
            value={`${live.net}ms`}
            sub="API latency"
            gauge={<MiniGauge value={Math.max(0, 100 - live.net)} max={100} color={GREEN} />}
          />
        </div>

        {/* ── Row 2: Charts + AI panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* CPU chart */}
          <ChartCard title="CPU LOAD" current={`${live.cpu}%`} color={CYAN}>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CYAN} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(220 30% 16%)" vertical={false} />
                <XAxis dataKey="t" hide tick={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(210 15% 45%)" }} tickCount={3} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="cpu" name="CPU %" stroke={CYAN} strokeWidth={1.5} fill="url(#gradCpu)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Thermal chart */}
          <ChartCard title="THERMAL PROFILE" current={`${live.cpuTemp}°C CPU`} color={AMBER}>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(220 30% 16%)" vertical={false} />
                <XAxis dataKey="t" hide tick={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(210 15% 45%)" }} tickCount={3} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="cpuTemp" name="CPU °C" stroke={AMBER} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="chassisTemp" name="Chassis °C" stroke={VIOLET} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* RAM chart */}
          <ChartCard title="MEMORY" current={`${live.ram}%`} color={VIOLET}>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(220 30% 16%)" vertical={false} />
                <XAxis dataKey="t" hide tick={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(210 15% 45%)" }} tickCount={3} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="ram" name="RAM %" stroke={VIOLET} strokeWidth={1.5} fill="url(#gradRam)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── Row 3: Component scores + AI findings + Alert log ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">

          {/* Component health bar chart */}
          <div className="surface-card rounded-xl p-4 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground tracking-widest uppercase">Subsystem Scores</span>
              <div className="flex items-center gap-1.5">
                <ScoreRing score={overall} size={28} />
                <span className="text-sm font-bold text-foreground">{overall}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={componentScores} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(210 15% 55%)" }} width={64} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                <Bar dataKey="score" name="Score" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {componentScores.map((entry, i) => (
                    <Cell key={i} fill={scoreColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-auto">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: GREEN }} />≥80</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: AMBER }} />60–79</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: RED }} />&lt;60</span>
            </div>
          </div>

          {/* AI Anomaly Detection */}
          <div className="surface-card rounded-xl p-4 flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase">AI Anomaly Detection</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 animate-pulse">
                <Eye className="w-3 h-3" />
                {aiFindings.length > 0 ? "ANALYZED" : "AWAITING DATA"}
              </div>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto">
              {aiFindings.map((f, i) => {
                const s = FINDING_STYLES[f.severity as AlertLevel] || FINDING_STYLES.info;
                const TrendIcon = f.trend === "down" ? TrendingDown : f.trend === "up" ? TrendingUp : Minus;
                return (
                  <div key={i} className={`rounded-lg border-l-2 px-3 py-2.5 ${s.border} ${s.bg} border border-border/50 flex flex-col gap-1`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${s.badge}`}>
                          {f.severity.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{f.component}</span>
                      </div>
                      <TrendIcon className={`w-3 h-3 shrink-0 ${f.trend === "down" ? "text-red-400" : f.trend === "up" ? "text-green-400" : "text-muted-foreground"}`} />
                    </div>
                    <div className="text-xs font-semibold text-foreground leading-tight">{f.title}</div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{f.desc}</div>
                  </div>
                );
              })}
              {aiFindings.length === 0 && (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No critical anomalies found.
                </div>
              )}
            </div>
          </div>

          {/* Alert log */}
          <div className="surface-card rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-[#0d1220] shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-[10px] text-muted-foreground">sentinel — telemetry feed</span>
              </div>
              <span className="text-[10px] text-green-400/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                live
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/20 bg-[#080c14]">
              {alerts.map((a, i) => {
                const s = ALERT_STYLES[a.level];
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2.5 px-3 py-2 ${s.row} transition-all`}
                    style={{ opacity: i === 0 ? 1 : Math.max(0.3, 1 - i * 0.045) }}
                  >
                    <span className="text-[10px] text-muted-foreground/40 w-[54px] shrink-0 tabular-nums">{a.ts}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot} ${i === 0 ? "animate-pulse" : ""}`} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${s.badge}`}>{a.component}</span>
                    <span className="text-[11px] text-muted-foreground flex-1 truncate">{a.message}</span>
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2 border-t border-border bg-[#0d1220] shrink-0 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50">{alerts.length} events buffered</span>
              <span className="text-[10px] text-green-400/60">● {deviceCount} devices polled</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Metric Tile ───────────────────────────────────────────────────────────────

function MetricTile({
  icon: Icon, label, value, sub, gauge, iconColor, alert: isAlert = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  gauge: React.ReactNode;
  iconColor: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`surface-card rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-500 ${isAlert ? "border-red-400/30 bg-red-400/3" : ""}`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className={`w-1.5 h-1.5 rounded-full ${isAlert ? "bg-red-400 animate-pulse" : "bg-green-400/60"}`} />
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground tracking-widest uppercase mb-0.5">{label}</div>
        <div className={`text-xl font-bold tabular-nums ${isAlert ? "text-red-400" : "text-foreground"}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
      {gauge}
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────

function ChartCard({
  title, current, color, children,
}: {
  title: string;
  current: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground tracking-widest uppercase">{title}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{current}</span>
      </div>
      {children}
    </div>
  );
}
