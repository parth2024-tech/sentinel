import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";
import { Link } from "wouter";
import {
  ArrowRight, GitCommit, Calendar, CheckCircle2, AlertTriangle,
  Battery, Thermometer, HardDrive, Cpu, Database, Eye, EyeOff,
} from "lucide-react";

// ── Changelog entries (newest first) ──────────────────────────────────────────

const changelog = [
  {
    version: "1.0",
    date: "May 2026",
    label: "Initial Release",
    description: "First public version of the Sentinel scoring engine. Establishes the baseline methodology for hardware health assessment.",
    changes: [
      {
        type: "added" as const,
        items: [
          "Weighted overall score: Battery 30%, Thermals 25%, Storage 25%, Memory 10%, CPU 10%",
          "Cycle-adjusted battery degradation analysis using exponential decay curve fitted to population data",
          "ACPI static thermal detection — identifies and excludes firmware-reported fixed temperatures",
          "NVMe S.M.A.R.T. health parsing with fallback scoring when vendor data is unavailable",
          "Reallocated sector detection as early SSD failure indicator",
          "Thermal throttle event counting (30-minute window)",
          "Cross-component correlation: thermal × battery degradation analysis",
          "Data quality transparency — structured warnings explain excluded data and OEM comparison context",
          "Health forecast timelines with population-based and device-specific projection modes",
          "OEM comparison context on every finding — shows what Dell SupportAssist, Lenovo Vantage, HP Support Assistant miss",
        ],
      },
    ],
  },
];

// ── What v1 intentionally does NOT score ──────────────────────────────────────

const notScored = [
  {
    item: "GPU health and VRAM degradation",
    reason: "Requires vendor-specific APIs (NVIDIA NVML, AMD ADL) that vary across driver versions. Planned for v2.",
  },
  {
    item: "Network adapter reliability",
    reason: "Network issues are typically software/driver-related, not hardware degradation. Low signal value for a hardware health tool.",
  },
  {
    item: "Display panel quality / dead pixels",
    reason: "Cannot be assessed without user interaction or camera-based testing. Outside the scope of passive hardware telemetry.",
  },
  {
    item: "Audio subsystem health",
    reason: "Speaker and microphone degradation can't be measured through system APIs without active testing.",
  },
  {
    item: "Fan RPM degradation curves",
    reason: "Fan RPM data is available on some platforms but the baseline varies too much across models. Planned for v2 with model-specific baselines.",
  },
  {
    item: "Keyboard / trackpad reliability",
    reason: "Input device degradation is mechanical and not measurable through software telemetry.",
  },
  {
    item: "BIOS/firmware vulnerability scoring",
    reason: "Security scoring is a separate domain. Sentinel focuses on hardware health, not security posture.",
  },
];

// ── Thresholds reference ──────────────────────────────────────────────────────

const thresholds = [
  {
    component: "Battery",
    icon: Battery,
    color: "text-primary",
    rules: [
      { condition: "health < 60%", result: "Critical finding", urgency: "critical" as const },
      { condition: "health < 75%", result: "Degradation warning", urgency: "warning" as const },
      { condition: "cycles > 500", result: "High cycle count", urgency: "warning" as const },
      { condition: "cycles > 800", result: "Very high cycle count", urgency: "critical" as const },
      { condition: "expected − actual > 8 pts", result: "Faster-than-normal wear (Pro)", urgency: "warning" as const },
      { condition: "expected − actual > 10 pts", result: "Score penalty up to 20 pts", urgency: "warning" as const },
    ],
  },
  {
    component: "Thermals",
    icon: Thermometer,
    color: "text-amber-400",
    rules: [
      { condition: "peak > 90°C", result: "Critical temperature", urgency: "critical" as const },
      { condition: "peak > 80°C", result: "Elevated temperature", urgency: "warning" as const },
      { condition: "throttle events > 5", result: "Throttle warning", urgency: "warning" as const },
      { condition: "throttle events > 15", result: "Critical throttling", urgency: "critical" as const },
      { condition: "ACPI static detected", result: "Excluded from scoring", urgency: "warning" as const },
      { condition: "peak > 78°C + battery degraded", result: "Thermal-battery correlation (Pro)", urgency: "warning" as const },
    ],
  },
  {
    component: "Storage",
    icon: HardDrive,
    color: "text-accent",
    rules: [
      { condition: "reallocated sectors > 0", result: "Critical — back up immediately", urgency: "critical" as const },
      { condition: "free space < 5%", result: "Critical free space", urgency: "critical" as const },
      { condition: "free space < 10%", result: "Low free space warning", urgency: "warning" as const },
      { condition: "wear level < 80%", result: "Elevated wear trajectory (Pro)", urgency: "warning" as const },
      { condition: "wear level < 50%", result: "Critical wear level", urgency: "critical" as const },
    ],
  },
  {
    component: "Memory",
    icon: Database,
    color: "text-violet-400",
    rules: [
      { condition: "used > 90%", result: "Score: 35 — Critical", urgency: "critical" as const },
      { condition: "used > 80%", result: "Score: 55 — Attention", urgency: "warning" as const },
      { condition: "used > 70%", result: "Score: 75 — Watch", urgency: "warning" as const },
    ],
  },
  {
    component: "CPU",
    icon: Cpu,
    color: "text-green-400",
    rules: [
      { condition: "avg load > 85%", result: "−20 point penalty", urgency: "warning" as const },
      { condition: "throttle events > 20", result: "−25 point penalty", urgency: "critical" as const },
      { condition: "throttle events > 10", result: "−15 point penalty", urgency: "warning" as const },
    ],
  },
];

const urgencyColors = {
  critical: "text-red-400 bg-red-400/8 border-red-400/20",
  warning: "text-amber-400 bg-amber-400/8 border-amber-400/20",
};

export default function Changelog() {
  return (
    <div className="px-6 py-20">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <AnimateIn>
          <div className="mb-16">
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
              ALGORITHM CHANGELOG
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mt-4 mb-6">
              Scoring methodology{" "}
              <span className="gradient-text">& changelog.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Every version of Sentinel's scoring algorithm is documented here. What it measures, what thresholds it uses, when it was written, and — critically — what it intentionally does <em>not</em> score yet.
            </p>
            <p className="text-sm text-muted-foreground/60 mt-4 leading-relaxed">
              No OEM tool has ever published a single scoring formula. We publish all of ours.
            </p>
            <div className="mt-6 flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
              <Link href="/scoring" className="text-primary hover:underline flex items-center gap-1">
                Full scoring formulas <ArrowRight className="w-3 h-3" />
              </Link>
              <span className="text-border">·</span>
              <Link href="/how-it-works" className="text-primary hover:underline flex items-center gap-1">
                How the agent works <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </AnimateIn>

        {/* ── Version History ──────────────────────────────────────────────── */}
        <AnimateIn delay={0.05}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <GitCommit className="w-5 h-5 text-primary" />
              Version history
            </h2>
            <div className="space-y-6">
              {changelog.map((entry) => (
                <div key={entry.version} className="surface-card rounded-xl p-6 border border-primary/20">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold font-mono text-primary">v{entry.version}</span>
                      <span className="text-xs font-mono text-muted-foreground/50 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        {entry.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 font-mono">
                      <Calendar className="w-3 h-3" />
                      {entry.date}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{entry.description}</p>
                  {entry.changes.map((group, gi) => (
                    <div key={gi}>
                      <ul className="space-y-2">
                        {group.items.map((item, ii) => (
                          <li key={ii} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground leading-relaxed">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </AnimateIn>

        {/* ── Trigger Thresholds ───────────────────────────────────────────── */}
        <AnimateIn delay={0.08}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Finding trigger thresholds
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-2xl">
              Every finding Sentinel produces is triggered by crossing a specific, documented threshold. There are no "AI-generated" or "heuristic" findings — every trigger condition is listed below.
            </p>
            <StaggerContainer className="space-y-4" staggerDelay={0.05}>
              {thresholds.map((t) => (
                <StaggerItem key={t.component}>
                  <div className="surface-card rounded-xl p-5 border border-border/60 hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                      <t.icon className={`w-5 h-5 ${t.color}`} />
                      <h3 className="font-semibold text-foreground">{t.component}</h3>
                    </div>
                    <div className="space-y-2">
                      {t.rules.map((r, ri) => (
                        <div key={ri} className="flex items-center justify-between gap-4 text-xs">
                          <code className="font-mono text-foreground/70 bg-background/60 px-2 py-1 rounded border border-border/30">{r.condition}</code>
                          <span className={`font-mono px-2 py-0.5 rounded border shrink-0 ${urgencyColors[r.urgency]}`}>{r.result}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>
        </AnimateIn>

        {/* ── What v1 Does NOT Score ───────────────────────────────────────── */}
        <AnimateIn delay={0.1}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-muted-foreground/60" />
              What Algorithm v1 intentionally does <em>not</em> score
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-2xl">
              Transparency means admitting what we <em>can't</em> measure yet. These are components or conditions that v1 does not evaluate, with our reasoning for each exclusion.
            </p>
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-3" staggerDelay={0.04}>
              {notScored.map((ns, i) => (
                <StaggerItem key={i}>
                  <div className="surface-card rounded-xl p-4 border border-border/60 h-full">
                    <div className="flex items-start gap-2 mb-2">
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                      <h4 className="text-sm font-semibold text-foreground">{ns.item}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">{ns.reason}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>
        </AnimateIn>

        {/* ── Methodology Principles ───────────────────────────────────────── */}
        <AnimateIn delay={0.12}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Methodology principles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: "Deterministic, not probabilistic",
                  detail: "Every score can be reproduced by hand from your raw hardware data. No machine learning, no black box, no random seed.",
                },
                {
                  title: "Conservative by default",
                  detail: "When data is uncertain or missing, Sentinel excludes the component rather than guessing. This may produce a higher score than reality — but never a falsely alarming one.",
                },
                {
                  title: "Transparent exclusions",
                  detail: "If Sentinel can't trust a data source (e.g. ACPI static readings), it tells you why, what it excluded, and how that differs from what OEM tools would show.",
                },
                {
                  title: "Versioned and immutable",
                  detail: "Each algorithm version is frozen at release. Your report will always show which version scored it, so you can compare future scans on the same basis.",
                },
              ].map((p, i) => (
                <div key={i} className="surface-card rounded-xl p-5 border border-border/60">
                  <h4 className="text-sm font-semibold text-foreground mb-2">{p.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </AnimateIn>

        {/* CTA */}
        <AnimateIn delay={0.14}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/scoring"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
            >
              Full scoring formulas
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all duration-200"
            >
              See a sample report
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </AnimateIn>

      </div>
    </div>
  );
}
