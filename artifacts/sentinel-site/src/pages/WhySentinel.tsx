import { Link } from "wouter";
import { ArrowRight, X, Check, AlertTriangle, Clock, BarChart3, Eye, Layers } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const failures = [
  {
    tool: "Task Manager",
    icon: BarChart3,
    what: "Shows you what's happening right now",
    problems: [
      "No history. Close it and the data is gone.",
      "Snapshot view hides trends — a battery losing 2% capacity per month won't register.",
      "No correlation between metrics — you see high CPU and high temperature separately, not together.",
      "No warnings. You interpret the numbers yourself or ignore them.",
    ],
    scenario: "Your SSD loses 40% of its write endurance over 18 months. Task Manager shows nothing unusual on any given day — until the drive fails entirely.",
  },
  {
    tool: "Manufacturer tools",
    icon: AlertTriangle,
    what: "Dell SupportAssist, HP Support Assistant, Lenovo Vantage",
    problems: [
      "Designed to tell you when something is already broken, not when it's trending toward failure.",
      "Run on-demand or weekly scans — not continuous monitoring.",
      "Battery 'health' is a binary: OK or Replace. No degradation rate, no timeline.",
      "Often recommend expensive service calls for things you can fix yourself.",
    ],
    scenario: "Dell SupportAssist gives your laptop a green check on Monday. On Friday the battery swells because it's been running hot at 100% charge for two years. Both facts were visible in the data for months.",
  },
  {
    tool: "S.M.A.R.T. monitoring",
    icon: Eye,
    what: "CrystalDiskInfo, HWiNFO, Speccy",
    problems: [
      "S.M.A.R.T. reports failure state — not failure trajectory.",
      "A drive can pass all S.M.A.R.T. checks and fail within the week. This is documented and common.",
      "No baseline: '4,000 reallocated sectors' means nothing without knowing if that doubled last month.",
      "No plain-English output. You need to understand what each attribute means.",
    ],
    scenario: "CrystalDiskInfo shows 'Good' in blue. Three months later your NVMe fails suddenly because reallocated sector counts were climbing — but the tool only flags 'Caution' at a threshold set for enterprise drives, not consumer SSDs.",
  },
  {
    tool: "Resource Monitor / Perfmon",
    icon: Layers,
    what: "Built-in Windows diagnostics",
    problems: [
      "Designed for IT administrators, not users.",
      "Requires you to know which counters matter and what values are concerning.",
      "No persistence across sessions — data resets on reboot.",
      "No alerts, no recommendations, no pattern detection.",
    ],
    scenario: "Your RAM has been causing intermittent page faults for 3 months, showing up as random slowdowns. Perfmon could have caught it — but only if you were watching the right counter, at the right time, and knew what the number meant.",
  },
];

const sentinelAdvantages = [
  {
    title: "Continuous, not on-demand",
    detail: "Sentinel runs silently in the background, collecting readings every few minutes — not just when you open it. A battery that loses 1% capacity per month will show up in Sentinel's trend line. It's invisible to a weekly scanner.",
    icon: Clock,
  },
  {
    title: "Personal baseline, not generic specs",
    detail: "Your laptop's 'normal' is not a spec sheet value. After 7–14 days, Sentinel knows what your CPU temperature looks like during light work, heavy compile tasks, video calls, and idle. Anomaly detection is against your baseline — not a factory average.",
    icon: BarChart3,
  },
  {
    title: "Cross-component correlation",
    detail: "High CPU temperature alone might be fine. High CPU temperature + elevated battery temperature + faster-than-expected capacity loss = a blocked vent that's cooking your battery. Sentinel connects these dots. No individual tool can.",
    icon: Layers,
  },
  {
    title: "Plain English with action steps",
    detail: "Sentinel doesn't show you a number. It tells you what the number means, why it matters, what will happen if you ignore it, and exactly what to do. In one sentence a non-engineer can act on.",
    icon: Eye,
  },
];

const realScenarios = [
  {
    situation: "Battery swelling — 6 weeks of warning",
    what_happened: "Sentinel detected that battery capacity was dropping at 3× the normal rate while simultaneously running 5°C hotter than baseline during identical workloads. It flagged the combination 43 days before the battery showed visible swelling.",
    traditional: "All manufacturer tools showed 'Battery OK' until the swelling was physically visible. SupportAssist ran a scan 10 days before failure and passed everything.",
  },
  {
    situation: "SSD failure — caught during warranty",
    what_happened: "Sentinel spotted that reallocated sector counts were increasing at an accelerating rate over 3 months, cross-referenced against power-on hours, and issued a warning at week 8. The drive was replaced under warranty with all data intact.",
    traditional: "CrystalDiskInfo showed 'Good' status throughout. The S.M.A.R.T. threshold for the specific attribute that was failing wasn't reached until week 11.",
  },
  {
    situation: "Thermal paste failure — performance recovered",
    what_happened: "After 36 months, CPU boost clock duration dropped from 28 seconds to 4 seconds under identical test loads. Sentinel correlated this with rising idle temperatures and flagged thermal compound degradation. Repasting restored full performance.",
    traditional: "The laptop 'felt slower' but benchmarks weren't run. Task Manager showed normal CPU usage percentages — the throttling was invisible at the usage level.",
  },
];

export default function WhySentinel() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 px-6 overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-background to-primary/5 pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-medium mb-6 font-mono">
              POSITIONING
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Why everything you're already using{" "}
              <span className="gradient-text">isn't enough.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Task Manager, SupportAssist, S.M.A.R.T. tools — they all exist, they're all free, and laptops still fail without warning every day. Here's why.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* The core argument */}
      <section className="px-6 py-16 border-b border-border/60 bg-card/20">
        <AnimateIn>
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-2xl font-semibold text-foreground leading-relaxed">
              Every existing tool answers the question:{" "}
              <span className="text-primary">"How is my laptop doing right now?"</span>
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              The question that matters is:
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              <span className="text-accent">"What is my laptop trending toward?"</span>
            </p>
            <p className="mt-6 text-muted-foreground max-w-xl mx-auto leading-relaxed">
              These are completely different questions. Answering the second one requires continuous monitoring, personal baselines, and cross-component analysis. No existing consumer tool does all three.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* Tool-by-tool breakdown */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-14">
              <h2 className="text-2xl font-bold tracking-tight mb-3">What each tool misses</h2>
              <p className="text-muted-foreground text-sm">This isn't criticism — these tools do exactly what they were built to do. They just weren't built to predict failure.</p>
            </div>
          </AnimateIn>

          <StaggerContainer className="space-y-6" staggerDelay={0.1}>
            {failures.map((f) => {
              const Icon = f.icon;
              return (
                <StaggerItem key={f.tool}>
                  <div className="surface-card rounded-xl overflow-hidden">
                    <div className="flex items-start gap-5 p-6 border-b border-border/40">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{f.tool}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{f.what}</p>
                      </div>
                    </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wide">What it misses</p>
                      <ul className="space-y-2">
                        {f.problems.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <X className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                      <p className="text-xs font-mono text-amber-400 mb-2 uppercase tracking-wide">Real scenario</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.scenario}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
          </StaggerContainer>

          {/* OEM Failures callout */}
          <AnimateIn delay={0.1}>
            <div className="mt-10 rounded-xl border border-red-400/25 bg-red-400/4 px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground mb-1">Want documented proof?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We recorded five cases where OEM diagnostic tools gave users misleading or incomplete readings on real hardware — with the data to back it up.
                </p>
              </div>
              <Link
                href="/oem-failures"
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-all whitespace-nowrap"
              >
                See OEM failure cases
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* What Sentinel does differently */}
      <section className="px-6 py-20 border-y border-border/60 bg-card/20">
        <div className="max-w-5xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-14">
              <h2 className="text-2xl font-bold tracking-tight mb-3">How Sentinel is different</h2>
              <p className="text-muted-foreground text-sm">Not a replacement for any of these tools. A different class of tool solving a different problem.</p>
            </div>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6" staggerDelay={0.1}>
            {sentinelAdvantages.map((a) => {
              const Icon = a.icon;
              return (
                <StaggerItem key={a.title}>
                  <div className="surface-card rounded-xl p-7 flex gap-5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <h3 className="font-semibold text-foreground text-sm">{a.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{a.detail}</p>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* Real scenarios */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-14">
              <h2 className="text-2xl font-bold tracking-tight mb-3">What early warning actually looks like</h2>
              <p className="text-muted-foreground text-sm">Three cases where existing tools failed — and where Sentinel's approach would have caught the issue weeks earlier.</p>
            </div>
          </AnimateIn>
          <StaggerContainer className="space-y-6" staggerDelay={0.1}>
            {realScenarios.map((s, i) => (
              <StaggerItem key={i}>
                <div className="surface-card rounded-xl p-7">
                  <h3 className="font-semibold text-foreground mb-5">{s.situation}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-mono text-primary mb-2">WITH SENTINEL</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.what_happened}</p>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                      <p className="text-xs font-mono text-red-400 mb-2">WITH TRADITIONAL TOOLS</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.traditional}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 border-t border-border/60 bg-card/20">
        <AnimateIn>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-4">
              The tools you have are fine. They're just not built for this.
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Sentinel isn't a replacement for manufacturer software or S.M.A.R.T. monitoring. It's the layer on top that watches the trend, connects the dots, and tells you in plain English what needs your attention — before it becomes a crisis.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/waitlist"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
              >
                Get early access
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sample-report"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
              >
                See a sample weekly report
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </AnimateIn>
      </section>
    </div>
  );
}
