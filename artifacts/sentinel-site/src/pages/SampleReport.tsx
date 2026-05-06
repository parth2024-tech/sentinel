import { Link } from "wouter";
import { ArrowRight, Calendar, Shield, TrendingDown, AlertTriangle, CheckCircle, Lightbulb, Activity } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const componentScores = [
  { label: "Battery",   score: 71, status: "Degrading",  color: "text-amber-400",  bar: "bg-amber-400",   note: "412 cycles · 78.2% capacity" },
  { label: "Storage",   score: 58, status: "Attention",  color: "text-orange-400", bar: "bg-orange-400",  note: "9% free space · SSD healthy" },
  { label: "CPU",       score: 94, status: "Healthy",    color: "text-green-400",  bar: "bg-green-400",   note: "23% avg load · no throttling" },
  { label: "Memory",    score: 88, status: "Healthy",    color: "text-green-400",  bar: "bg-green-400",   note: "32 GB · 43% avg usage" },
  { label: "Thermals",  score: 62, status: "Watch",      color: "text-amber-400",  bar: "bg-amber-400",   note: "71°C idle · 14 throttle events" },
  { label: "GPU",       score: 96, status: "Healthy",    color: "text-green-400",  bar: "bg-green-400",   note: "RTX 3050 Ti · 0 crashes" },
  { label: "Startup",   score: 91, status: "Healthy",    color: "text-green-400",  bar: "bg-green-400",   note: "11.2 s boot · 8 startup items" },
  { label: "Network",   score: 83, status: "Healthy",    color: "text-green-400",  bar: "bg-green-400",   note: "Intel AX211 · 0 drop events" },
  { label: "Drivers",   score: 77, status: "Check",      color: "text-cyan-400",   bar: "bg-cyan-400",    note: "BIOS 14 months old" },
];

const urgentFindings = [
  {
    severity: "critical",
    component: "STORAGE",
    title: "Disk space critically low — 47 GB remaining (9%)",
    detail: "Windows needs 10–15% free space to run updates, write restore points, and wear-level the SSD correctly. Below 10%, update installations begin failing silently. Below 5%, the system can lock up.",
    action: "Run Disk Cleanup (search in Start menu), then move large files (Downloads, Videos) to an external drive or cloud storage. Target: at least 80 GB free.",
    prediction: "If left under 10% for another 3 months, SSD write endurance will accumulate at roughly 2× the normal rate.",
    color: "border-red-500/40 bg-red-500/5",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: AlertTriangle,
    iconColor: "text-red-400",
    iconBg: "bg-red-500/15 border-red-500/30",
  },
  {
    severity: "warning",
    component: "THERMALS",
    title: "CPU running 71°C at idle — 14 throttle events last week",
    detail: "For a Core i7-12700H, 71°C at idle is elevated. During tasks it likely hit 95°C+ and triggered thermal throttling 14 times — each throttle event cuts performance by 30–50% for several seconds.",
    action: "Check that vents (bottom and left side) aren't blocked. Use on hard surfaces only. If the issue persists after cleaning vents, the thermal paste on the CPU die may need replacing (common after 3+ years).",
    prediction: "Sustained high idle temps accelerate battery degradation by approximately 5–8% per year beyond normal.",
    color: "border-amber-500/40 bg-amber-500/5",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: TrendingDown,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/15 border-amber-500/30",
  },
  {
    severity: "warning",
    component: "BATTERY",
    title: "Battery at 78.2% capacity — degrading 3× faster than expected",
    detail: "This battery's design capacity is 86,000 mWh. Full charge capacity has dropped to 67,240 mWh across 412 cycles. That's a faster-than-average decline, likely caused by sustained high temperatures and frequent 100% charges.",
    action: "Stop charging to 100%. Use your laptop plugged in at 60–80% when at a desk. Most BIOS/OEM utilities can cap charging — check Dell Power Manager. Start planning for battery replacement in the next 12 months.",
    color: "border-amber-500/40 bg-amber-500/5",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: TrendingDown,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/15 border-amber-500/30",
  },
];

const patterns = [
  {
    title: "Heat + battery degradation loop",
    detail: "Your CPU runs hot at idle → the chassis heats up → the battery sits at elevated temperature while charging. Lithium cells permanently lose capacity faster above 35°C. All three problems share one root cause: airflow. Cleaning or raising the laptop could reduce all three simultaneously.",
  },
  {
    title: "Low disk space is worsening thermals",
    detail: "When disk space is critically low, Windows writes the pagefile inefficiently — causing the SSD to work harder, generating more heat, and contributing to elevated CPU temperatures even at idle. Freeing 80+ GB would reduce pagefile fragmentation and lower background disk activity.",
  },
];

const habits = [
  {
    icon: "🔋",
    title: "Charging habit",
    tip: "You've charged to 100% on 28 of the last 30 days. Charging to 80% and keeping the laptop unplugged below 20% is the single most impactful thing you can do for long-term battery health.",
  },
  {
    icon: "🌡️",
    title: "Surface habit",
    tip: "Usage patterns suggest the laptop is often on a soft surface. Bottom-mounted vents are your primary exhaust — even partial blockage raises idle temps by 8–12°C. A $12 laptop stand solves this.",
  },
  {
    icon: "🔄",
    title: "Restart habit",
    tip: "Last restart was 9 days ago. A weekly restart takes 90 seconds, clears accumulated memory leaks, applies security updates, and resets driver states that drift over time.",
  },
];

const overallScore = 79;
const overallGrade = "B — Good";
const overallColor = "text-cyan-400";

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
        <circle
          cx="64" cy="64" r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-cyan-400 transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono text-cyan-400">{score}</span>
        <span className="text-xs text-muted-foreground font-mono">/100</span>
      </div>
    </div>
  );
}

export default function SampleReport() {
  const criticalCount = urgentFindings.filter(f => f.severity === "critical").length;
  const warningCount  = urgentFindings.filter(f => f.severity === "warning").length;
  const healthyCount  = componentScores.filter(c => c.score >= 85).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sample Data Disclaimer Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-center text-xs font-mono text-amber-400 flex items-center justify-center gap-2">
        <span>⚠️</span>
        <span><strong>Sample Report:</strong> This page displays simulated/static diagnostic data for demonstration purposes. It does not represent live telemetry from your current machine.</span>
      </div>
      {/* Header band */}
      <AnimateIn direction="down" delay={0.1}>
        <div className="border-b border-border/60 bg-card/40 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-mono text-muted-foreground">SENTINEL WEEKLY HEALTH REPORT</p>
                <p className="text-sm font-semibold text-foreground">Dell XPS 15 9520 — Serial 7XK2P93</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Calendar className="w-3.5 h-3.5" />
              Week of May 5, 2026
            </div>
          </div>
        </div>
      </AnimateIn>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">

        {/* Hero score */}
        <AnimateIn>
          <div className="surface-card rounded-2xl p-8 flex flex-col md:flex-row items-center gap-10">
            <ScoreRing score={overallScore} />
            <div className="flex-1 text-center md:text-left">
              <p className="text-xs font-mono text-muted-foreground mb-1">OVERALL HEALTH</p>
              <h1 className={`text-4xl font-bold font-mono mb-1 ${overallColor}`}>{overallGrade}</h1>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Your laptop is in generally good shape. Two issues need attention this week — disk space and thermals — and your battery is degrading faster than expected for its age.
              </p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-muted-foreground">{criticalCount} critical</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-muted-foreground">{warningCount} warnings</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-muted-foreground">{healthyCount} components healthy</span>
                </div>
              </div>
            </div>
          </div>
        </AnimateIn>

        {/* Component scores */}
        <div className="space-y-4">
          <AnimateIn>
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Component Breakdown</h2>
          </AnimateIn>
          <StaggerContainer className="surface-card rounded-xl overflow-hidden divide-y divide-border/40" staggerDelay={0.05}>
            {componentScores.map((c) => (
              <StaggerItem key={c.label}>
                <div className="flex items-center gap-4 px-6 py-4">
                  <span className="text-sm font-medium text-foreground w-20 shrink-0">{c.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.bar} transition-all duration-1000`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono w-24 text-right shrink-0 ${c.color}`}>
                    {c.score}/100 · {c.status}
                  </span>
                  <span className="text-xs text-muted-foreground hidden lg:block w-52 shrink-0 text-right">
                    {c.note}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Urgent findings */}
        <div className="space-y-4">
          <AnimateIn>
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Findings Requiring Attention</h2>
          </AnimateIn>
          <StaggerContainer className="space-y-4" staggerDelay={0.1}>
            {urgentFindings.map((f, i) => (
              <StaggerItem key={i}>
                <div className={`rounded-xl border p-6 ${f.color}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${f.iconBg}`}>
                      <f.icon className={`w-4 h-4 ${f.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded border ${f.badge}`}>
                          {f.component}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-2 leading-snug">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">{f.detail}</p>
                      <div className="rounded-lg bg-background/40 border border-border/40 px-4 py-3">
                        <p className="text-xs font-mono text-primary mb-1">WHAT TO DO</p>
                        <p className="text-sm text-foreground leading-relaxed">{f.action}</p>
                      </div>
                      {f.prediction && (
                        <p className="text-xs text-muted-foreground mt-3 italic">
                          Sentinel prediction: {f.prediction}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Cross-component patterns */}
        <div className="space-y-4">
          <AnimateIn>
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
              <Activity className="w-3.5 h-3.5 inline mr-2 text-primary" />
              Patterns Detected
            </h2>
          </AnimateIn>
          <StaggerContainer className="space-y-3" staggerDelay={0.1}>
            {patterns.map((p, i) => (
              <StaggerItem key={i}>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <p className="text-xs font-mono text-primary mb-2">🔍 {p.title.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.detail}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Habit coaching */}
        <div className="space-y-4">
          <AnimateIn>
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
              <Lightbulb className="w-3.5 h-3.5 inline mr-2 text-primary" />
              Usage Habits
            </h2>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4" staggerDelay={0.1}>
            {habits.map((h, i) => (
              <StaggerItem key={i}>
                <div className="surface-card rounded-xl p-5 h-full">
                  <div className="text-2xl mb-3">{h.icon}</div>
                  <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wide">{h.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{h.tip}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* All-clear items */}
        <AnimateIn>
          <div className="surface-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-semibold text-foreground">All-clear items this week</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                "GPU — no driver crashes or TDR events",
                "RAM — no hardware errors detected via HCI memtest",
                "Network — zero Wi-Fi drop events, DNS responding normally",
                "SMART — NVMe SSD passed all S.M.A.R.T. attribute checks",
                "Boot — 11.2 s average, no startup delay events",
                "System integrity — SFC scan: 0 corrupt files",
                "BSOD history — 0 unexpected shutdowns in last 30 days",
                "Drivers — all critical drivers have no error codes in Device Manager",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimateIn>

        {/* Footer */}
        <AnimateIn delay={0.2}>
          <div className="text-center pt-4 pb-8 space-y-6">
            <div className="border-t border-border/60 pt-8">
              <p className="text-xs text-muted-foreground mb-1">Next recommended scan: May 12, 2026</p>
              <p className="text-xs text-muted-foreground">All analysis ran locally on your device. No data was sent anywhere.</p>
            </div>

            <div className="surface-card rounded-xl p-6 max-w-md mx-auto">
              <p className="text-sm font-semibold text-foreground mb-2">This is what Sentinel sends you every week.</p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                No numbers without context. No alerts without action steps. No doom — just what matters and what to do about it.
              </p>
              <Link
                href="/waitlist"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
              >
                Get this for your laptop
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </AnimateIn>
      </div>
    </div>
  );
}
