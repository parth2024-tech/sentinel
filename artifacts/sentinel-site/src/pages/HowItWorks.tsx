import { Link } from "wouter";
import { Download, Eye, Zap, MessageSquare, ArrowRight, Database, Brain, Lock, BarChart2 } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const steps = [
  {
    number: "01",
    icon: Download,
    title: "Install silently",
    description: "Sentinel installs as a lightweight background service. No taskbar icon, no splash screen, no interruptions. It starts collecting baseline data immediately — you'll never notice it's there.",
    color: "text-primary",
    borderColor: "border-primary/30",
  },
  {
    number: "02",
    icon: Eye,
    title: "Learns your normal",
    description: "Over the first few days, Sentinel profiles how your machine behaves under your specific workloads. Your laptop's normal becomes the baseline — not a generic spec sheet.",
    color: "text-accent",
    borderColor: "border-accent/30",
  },
  {
    number: "03",
    icon: Zap,
    title: "Detects drift and correlations",
    description: "Sentinel continuously compares current readings against your baseline. When it spots drift — a metric trending in the wrong direction — it cross-references it with other signals to confirm and score the risk.",
    color: "text-primary",
    borderColor: "border-primary/30",
  },
  {
    number: "04",
    icon: MessageSquare,
    title: "Tells you in plain English",
    description: "When something warrants your attention, Sentinel delivers a clear, actionable notification. No alarm sounds for normal wear. Only a precise, calm message when you actually need to do something.",
    color: "text-accent",
    borderColor: "border-accent/30",
  },
];

// Sample alert mock
function AlertMock() {
  return (
    <div className="surface-card rounded-xl p-5 max-w-sm border border-border/80" data-testid="mock-alert">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono text-amber-400">DIAGNOSTIC ALERT</span>
            <span className="text-xs text-muted-foreground font-mono">2 days ago</span>
          </div>
          <p className="text-sm text-foreground leading-snug font-medium mb-2">
            Battery capacity dropping faster than expected for its age.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Detected a 12% capacity loss over 30 days — 3x the normal rate. Consider avoiding full charges to slow further degradation.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              BATTERY
            </span>
            <span className="text-xs text-muted-foreground">Risk: Moderate</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sample weekly health letter mock
function WeeklyLetterMock() {
  const subsystems = [
    { label: "Battery", status: "Degrading", color: "text-amber-400", bar: 72 },
    { label: "SSD", status: "Healthy", color: "text-primary", bar: 97 },
    { label: "CPU", status: "Healthy", color: "text-primary", bar: 94 },
    { label: "Thermals", status: "Watch", color: "text-orange-400", bar: 81 },
    { label: "RAM", status: "Healthy", color: "text-primary", bar: 99 },
  ];

  return (
    <div className="surface-card rounded-xl p-6 max-w-sm" data-testid="mock-weekly-report">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">WEEKLY HEALTH REPORT</p>
          <p className="font-semibold text-foreground">
            Week of {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-glow-pulse" />
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-5">
        {subsystems.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{s.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                style={{ width: `${s.bar}%` }}
              />
            </div>
            <span className={`text-xs font-mono shrink-0 ${s.color}`}>{s.status}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground mb-2 font-mono">THIS WEEK'S RECOMMENDATION</p>
        <p className="text-xs text-foreground leading-relaxed">
          Charge to 80% instead of 100% until your next battery calibration. This alone could extend your battery's remaining lifespan by several months.
        </p>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <div className="px-6 py-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <AnimateIn>
          <div className="max-w-2xl mb-20">
            <div className="mb-4">
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                HOW IT WORKS
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6" data-testid="heading-how-it-works">
              Four steps to{" "}
              <span className="gradient-text">hardware foresight.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Sentinel is designed to be invisible until you need it. Here's what happens from installation to your first insight.
            </p>
          </div>
        </AnimateIn>

        {/* Steps — staggered */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24" staggerDelay={0.1}>
          {steps.map((step) => (
            <StaggerItem key={step.number}>
              <div
                className="surface-card rounded-xl p-8 flex flex-col gap-5 hover:border-primary/40 transition-all duration-300 group h-full"
                data-testid={`card-step-${step.number}`}
              >
                <div className="flex items-start gap-5">
                  <div className="flex flex-col items-center gap-3">
                    <span className={`text-4xl font-bold font-mono ${step.color} opacity-30 leading-none`}>
                      {step.number}
                    </span>
                    <div className={`w-10 h-10 rounded-xl bg-card border ${step.borderColor} flex items-center justify-center ${step.color} group-hover:border-primary/40 transition-colors`}>
                      <step.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Technical credibility */}
        <div className="border-t border-border/60 pt-20 mb-20">
          <AnimateIn>
            <div className="text-center mb-14">
              <h2 className="text-2xl font-bold tracking-tight mb-3">How it actually works</h2>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                No black-box AI. No magic. Here's the exact mechanism behind every finding Sentinel surfaces.
              </p>
            </div>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6" staggerDelay={0.1}>

            {/* Telemetry */}
            <StaggerItem>
            <div className="surface-card rounded-xl p-7 flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Telemetry collection</h3>
                  <p className="text-xs font-mono text-muted-foreground">Every 60–180 seconds</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sentinel reads from Windows Management Instrumentation (WMI) and CIM — the same interfaces used by Dell Command Monitor and HP Support Assistant. These are read-only system calls. No kernel drivers are installed.
              </p>
              <div className="rounded-lg bg-[#0a0e1a] border border-border/40 p-4 font-mono text-xs space-y-1">
                <div className="text-muted-foreground/50"># Sources polled each cycle</div>
                <div className="text-cyan-400">Win32_Battery          <span className="text-slate-400">→ charge, discharge rate, cycles</span></div>
                <div className="text-cyan-400">MSAcpi_ThermalZoneTemp <span className="text-slate-400">→ all thermal zones</span></div>
                <div className="text-cyan-400">Win32_DiskDrive        <span className="text-slate-400">→ SMART attributes, wear</span></div>
                <div className="text-cyan-400">Win32_PerfFormattedData<span className="text-slate-400">→ CPU, RAM pressure</span></div>
                <div className="text-cyan-400">MSFT_PhysicalDisk      <span className="text-slate-400">→ NVMe endurance</span></div>
              </div>
            </div>
            </StaggerItem>

            {/* Baseline learning */}
            <StaggerItem>
            <div className="surface-card rounded-xl p-7 flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Baseline learning</h3>
                  <p className="text-xs font-mono text-muted-foreground">Personalised in 7–14 days</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Each metric is modelled as a distribution across your usage contexts — idle, light load, heavy load, charging, discharging. Your "normal" CPU temperature at idle is different from a generic spec sheet value. Anomaly detection uses your distribution, not a manufacturer threshold.
              </p>
              <div className="rounded-lg bg-[#0a0e1a] border border-border/40 p-4 font-mono text-xs space-y-1">
                <div className="text-muted-foreground/50"># Per-metric baseline model</div>
                <div className="text-violet-400">window  <span className="text-slate-400">= rolling 30-day sliding buffer</span></div>
                <div className="text-violet-400">context <span className="text-slate-400">= [idle | load | charging | battery]</span></div>
                <div className="text-violet-400">μ, σ    <span className="text-slate-400">= mean + std dev per context</span></div>
                <div className="text-violet-400">z_score <span className="text-slate-400">= (reading − μ) / σ</span></div>
              </div>
            </div>
            </StaggerItem>

            {/* Local processing */}
            <StaggerItem>
            <div className="surface-card rounded-xl p-7 flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Local processing only</h3>
                  <p className="text-xs font-mono text-muted-foreground">Zero network calls during analysis</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All baseline models, anomaly scoring, and report generation run on your machine. Sentinel makes no outbound HTTP requests during normal operation. Your hardware telemetry — serial numbers, temperatures, usage patterns — is never transmitted.
              </p>
              <div className="rounded-lg bg-[#0a0e1a] border border-border/40 p-4 font-mono text-xs space-y-1">
                <div className="text-muted-foreground/50"># Sentinel network activity</div>
                <div className="text-green-400">license_check  <span className="text-slate-400">→ once per 24h, anonymous token</span></div>
                <div className="text-green-400">update_check   <span className="text-slate-400">→ once per week, version string only</span></div>
                <div className="text-red-400/70">telemetry      <span className="text-slate-400">→ NEVER. All analysis is local.</span></div>
                <div className="text-red-400/70">hardware_data  <span className="text-slate-400">→ NEVER. Stays on your device.</span></div>
              </div>
            </div>
            </StaggerItem>

            {/* Anomaly scoring */}
            <StaggerItem>
            <div className="surface-card rounded-xl p-7 flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
                  <BarChart2 className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Anomaly scoring</h3>
                  <p className="text-xs font-mono text-muted-foreground">Weighted, correlated, confirmed</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A single out-of-range reading doesn't trigger a notification. Sentinel requires either sustained deviation over multiple readings, or corroboration from a related metric. Battery temperature alone isn't flagged. Battery temperature + accelerating capacity loss + elevated charge cycles together is a pattern.
              </p>
              <div className="rounded-lg bg-[#0a0e1a] border border-border/40 p-4 font-mono text-xs space-y-1">
                <div className="text-muted-foreground/50"># Alert trigger conditions</div>
                <div className="text-amber-400">single_metric  <span className="text-slate-400">z &gt; 3.0 sustained 4+ readings</span></div>
                <div className="text-amber-400">correlated     <span className="text-slate-400">z &gt; 2.0 on 2+ related metrics</span></div>
                <div className="text-amber-400">trend          <span className="text-slate-400">monotonic drift &gt; 14 days</span></div>
                <div className="text-amber-400">weight         <span className="text-slate-400">severity × component_criticality</span></div>
              </div>
            </div>
            </StaggerItem>

          </StaggerContainer>
        </div>

        {/* Mocks section */}
        <div className="border-t border-border/60 pt-20">
          <AnimateIn>
            <div className="text-center mb-14">
              <h2 className="text-2xl font-bold tracking-tight mb-3">What it actually looks like</h2>
              <p className="text-muted-foreground text-sm">Precise, readable, calm. Not a wall of numbers.</p>
            </div>
          </AnimateIn>
          <StaggerContainer className="flex flex-col md:flex-row items-start justify-center gap-8" staggerDelay={0.15}>
            <StaggerItem>
              <div className="flex flex-col gap-3 items-center">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Sample Alert</span>
                <AlertMock />
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="flex flex-col gap-3 items-center">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Weekly Report</span>
                <WeeklyLetterMock />
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>

        {/* CTA */}
        <AnimateIn delay={0.1}>
          <div className="mt-20 text-center">
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
              data-testid="button-how-it-works-waitlist"
            >
              Get early access
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </AnimateIn>
      </div>
    </div>
  );
}
