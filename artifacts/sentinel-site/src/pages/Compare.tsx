import React from "react";
import { Link } from "wouter";
import { ArrowRight, Check, X, Minus } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

type Val = "yes" | "no" | "partial" | "label";

interface Row {
  feature: string;
  category: string;
  sentinel: Val;
  taskmanager: Val;
  crystal: Val;
  supportassist: Val;
  hwinfo: Val;
  note?: string;
}

const tools = [
  { id: "sentinel",     label: "Sentinel",          sub: "This app",              highlight: true  },
  { id: "taskmanager",  label: "Task Manager",       sub: "Built into Windows",    highlight: false },
  { id: "crystal",      label: "CrystalDiskInfo",    sub: "S.M.A.R.T. monitor",   highlight: false },
  { id: "supportassist",label: "SupportAssist",      sub: "Dell / HP / Lenovo",    highlight: false },
  { id: "hwinfo",       label: "HWiNFO64",           sub: "Hardware monitor",      highlight: false },
];

const rows: Row[] = [
  // Monitoring scope
  { category: "Monitoring",  feature: "Real-time hardware readings",       sentinel: "yes",     taskmanager: "yes",     crystal: "partial", supportassist: "partial", hwinfo: "yes",     },
  { category: "Monitoring",  feature: "Continuous background monitoring",  sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "partial", hwinfo: "partial", note: "HWiNFO runs in foreground only; SupportAssist scans on-demand" },
  { category: "Monitoring",  feature: "Battery cycle count & capacity",    sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "yes",     hwinfo: "partial", },
  { category: "Monitoring",  feature: "SSD S.M.A.R.T. attributes",        sentinel: "yes",     taskmanager: "no",      crystal: "yes",     supportassist: "partial", hwinfo: "yes",     },
  { category: "Monitoring",  feature: "NVMe endurance / wear level",       sentinel: "yes",     taskmanager: "no",      crystal: "yes",     supportassist: "no",      hwinfo: "yes",     },
  { category: "Monitoring",  feature: "Thermal zone temps (all zones)",    sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "partial", hwinfo: "yes",     },
  { category: "Monitoring",  feature: "CPU throttle event detection",      sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "partial", },
  { category: "Monitoring",  feature: "RAM pressure & pagefile analysis",  sentinel: "yes",     taskmanager: "partial",  crystal: "no",      supportassist: "no",      hwinfo: "yes",     },
  { category: "Monitoring",  feature: "Network stability & drop events",   sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "no",      },
  { category: "Monitoring",  feature: "Boot duration history",             sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "partial", hwinfo: "no",      },

  // Intelligence
  { category: "Intelligence", feature: "Personal baseline learning",       sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "no",      note: "Sentinel builds a model of your normal over 7–14 days" },
  { category: "Intelligence", feature: "Anomaly detection vs your normal", sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "no",      },
  { category: "Intelligence", feature: "Degradation rate tracking",        sentinel: "yes",     taskmanager: "no",      crystal: "partial",  supportassist: "partial", hwinfo: "no",      note: "CrystalDiskInfo & SupportAssist show current value, not trend rate" },
  { category: "Intelligence", feature: "Cross-component correlation",      sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "no",      note: "e.g. high temp + battery degradation + throttling = vent blockage" },
  { category: "Intelligence", feature: "Trend forecasting (weeks ahead)",  sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "no",      },
  { category: "Intelligence", feature: "Habit coaching & usage patterns",  sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "no",      },

  // Output & usability
  { category: "Output",      feature: "Plain-English alerts",              sentinel: "yes",     taskmanager: "no",      crystal: "partial",  supportassist: "yes",     hwinfo: "no",      },
  { category: "Output",      feature: "Actionable recommendations",        sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "partial", hwinfo: "no",      },
  { category: "Output",      feature: "Weekly health report",              sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "partial", hwinfo: "no",      note: "SupportAssist scan results are reactive, not trend-based summaries" },
  { category: "Output",      feature: "Predictive failure timeline",       sentinel: "yes",     taskmanager: "no",      crystal: "no",      supportassist: "no",      hwinfo: "no",      },
  { category: "Output",      feature: "Useful without technical knowledge",sentinel: "yes",     taskmanager: "partial",  crystal: "no",      supportassist: "yes",     hwinfo: "no",      },

  // Privacy & performance
  { category: "Privacy",     feature: "Zero cloud telemetry",              sentinel: "yes",     taskmanager: "yes",     crystal: "yes",     supportassist: "no",      hwinfo: "yes",     note: "SupportAssist sends diagnostic data to manufacturer servers" },
  { category: "Privacy",     feature: "No account required",               sentinel: "yes",     taskmanager: "yes",     crystal: "yes",     supportassist: "no",      hwinfo: "yes",     },
  { category: "Privacy",     feature: "CPU overhead < 1%",                 sentinel: "yes",     taskmanager: "yes",     crystal: "yes",     supportassist: "partial", hwinfo: "no",      note: "HWiNFO and SupportAssist can spike CPU during active scans" },
];

const categories = Array.from(new Set(rows.map((r) => r.category)));

function Cell({ val, highlight }: { val: Val; highlight: boolean }) {
  if (val === "yes") {
    return (
      <td className={`px-4 py-3 text-center ${highlight ? "bg-primary/5" : ""}`}>
        <div className="flex justify-center">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${highlight ? "bg-primary/20 border border-primary/40" : "bg-green-500/10"}`}>
            <Check className={`w-3 h-3 ${highlight ? "text-primary" : "text-green-500"}`} strokeWidth={2.5} />
          </div>
        </div>
      </td>
    );
  }
  if (val === "partial") {
    return (
      <td className={`px-4 py-3 text-center ${highlight ? "bg-primary/5" : ""}`}>
        <div className="flex justify-center">
          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-500/10">
            <Minus className="w-3 h-3 text-amber-500" strokeWidth={2.5} />
          </div>
        </div>
      </td>
    );
  }
  return (
    <td className={`px-4 py-3 text-center ${highlight ? "bg-primary/5" : ""}`}>
      <div className="flex justify-center">
        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-muted/20">
          <X className="w-3 h-3 text-muted-foreground/30" strokeWidth={2.5} />
        </div>
      </div>
    </td>
  );
}

function ScoreBadge({ tool }: { tool: typeof tools[0] }) {
  const toolRows = rows.filter((r) => r[tool.id as keyof Row] !== "label");
  const yes  = toolRows.filter((r) => r[tool.id as keyof Row] === "yes").length;
  const part = toolRows.filter((r) => r[tool.id as keyof Row] === "partial").length;
  const total = toolRows.length;
  const score = Math.round(((yes + part * 0.5) / total) * 100);
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
      tool.highlight
        ? "text-primary border-primary/40 bg-primary/10"
        : "text-muted-foreground border-border/40 bg-muted/10"
    }`}>
      {score}% coverage
    </span>
  );
}

export default function Compare() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 px-6 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-background to-accent/4 pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono mb-6">
              FEATURE COMPARISON
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
              Sentinel vs. everything else.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A side-by-side look at what each tool actually covers — and where the gaps are that Sentinel fills.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* Legend */}
      <section className="px-6 py-6 border-b border-border/40 bg-card/20">
        <AnimateIn delay={0.05}>
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-6 text-sm">
            <span className="text-muted-foreground text-xs font-mono uppercase tracking-wide">Legend</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-primary/20 border border-primary/40">
                <Check className="w-3 h-3 text-primary" strokeWidth={2.5} />
              </div>
              <span className="text-sm text-muted-foreground">Full support</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-amber-500/10">
                <Minus className="w-3 h-3 text-amber-500" strokeWidth={2.5} />
              </div>
              <span className="text-sm text-muted-foreground">Partial / limited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-muted/20">
                <X className="w-3 h-3 text-muted-foreground/30" strokeWidth={2.5} />
              </div>
              <span className="text-sm text-muted-foreground">Not supported</span>
            </div>
          </div>
        </AnimateIn>
      </section>

      {/* Table */}
      <section className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <AnimateIn delay={0.08}>
            <div className="rounded-xl border border-border/60 overflow-hidden overflow-x-auto shadow-xl">
              <table className="w-full border-collapse text-sm">
                {/* Column headers */}
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left px-5 py-5 text-muted-foreground font-medium text-xs uppercase tracking-wide w-56 bg-card/60">
                      Feature
                    </th>
                    {tools.map((t) => (
                      <th
                        key={t.id}
                        className={`px-4 py-5 text-center min-w-[120px] ${
                          t.highlight ? "bg-primary/8 border-x border-primary/20" : "bg-card/60"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`font-semibold text-sm ${t.highlight ? "text-primary" : "text-foreground"}`}>
                            {t.label}
                          </span>
                          <span className="text-xs text-muted-foreground font-normal">{t.sub}</span>
                          <ScoreBadge tool={t} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const catRows = rows.filter((r) => r.category === cat);
                    return (
                      <React.Fragment key={cat}>
                        {/* Category header */}
                        <tr className="border-b border-border/40 bg-muted/5">
                          <td
                            colSpan={tools.length + 1}
                            className="px-5 py-2.5"
                          >
                            <span className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
                              {cat}
                            </span>
                          </td>
                        </tr>
                        {catRows.map((row, i) => (
                          <tr
                            key={row.feature}

                            className={`border-b border-border/30 hover:bg-white/[0.01] transition-colors ${
                              i === catRows.length - 1 ? "border-border/60" : ""
                            }`}
                          >
                            <td className="px-5 py-3.5">
                              <div>
                                <span className="text-sm text-foreground/90">{row.feature}</span>
                                {row.note && (
                                  <p className="text-xs text-muted-foreground/50 mt-0.5 leading-relaxed">{row.note}</p>
                                )}
                              </div>
                            </td>
                            {tools.map((t) => (
                              <Cell
                                key={t.id}
                                val={row[t.id as keyof Row] as Val}
                                highlight={t.highlight}
                              />
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AnimateIn>

          {/* Footnote */}
          <AnimateIn delay={0.12}>
            <p className="text-xs text-muted-foreground/50 mt-4 text-center leading-relaxed">
              Comparison based on publicly documented capabilities as of May 2026. "Partial" indicates the feature exists but is limited in depth, frequency, or usability for non-technical users.
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* Key differences callout */}
      <section className="px-6 py-16 border-y border-border/60 bg-card/10">
        <div className="max-w-5xl mx-auto">
          <AnimateIn>
            <h2 className="text-xl font-bold tracking-tight mb-8 text-center">Three things no other tool on this list does</h2>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5" staggerDelay={0.08}>
            {[
              {
                title: "Personal baseline",
                detail: "Every other tool compares your hardware against a fixed threshold — usually a manufacturer spec or a generic warning value. Sentinel compares against your own history. Your laptop's normal is the reference, not a factory average.",
              },
              {
                title: "Cross-component correlation",
                detail: "High CPU temperature means something different when it's also paired with accelerating battery capacity loss and elevated discharge rates. No individual tool connects these signals. Sentinel does — automatically.",
              },
              {
                title: "Trend forecasting",
                detail: "Every tool on this list tells you what's true right now. Sentinel models the trajectory — how fast something is changing, whether the rate is accelerating, and what that implies for the next 30–90 days.",
              },
            ].map((item) => (
              <StaggerItem key={item.title}>
                <div className="surface-card rounded-xl p-6 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <AnimateIn>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-4">
              The gap is real. Sentinel fills it.
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Keep using the tools you already have — they're good at what they do. Sentinel adds the one thing they all share: no memory of the past, no model of where things are going.
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
