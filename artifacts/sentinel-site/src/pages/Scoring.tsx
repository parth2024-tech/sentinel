import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";
import React, { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Battery, Thermometer, HardDrive, Cpu, Database, Calculator, GitCommit, AlertTriangle } from "lucide-react";

const componentWeights = [
  { name: "Battery", weight: 30, icon: Battery, color: "text-primary", detail: "Heaviest weight — runtime and unexpected shutdown risk are the primary end-user pain points." },
  { name: "Thermals", weight: 25, icon: Thermometer, color: "text-amber-400", detail: "Sustained heat accelerates every other component's degradation, making it a multiplier risk." },
  { name: "Storage", weight: 25, icon: HardDrive, color: "text-accent", detail: "Data loss risk. Reallocated sectors are a strong leading indicator of imminent failure." },
  { name: "Memory", weight: 10, icon: Database, color: "text-violet-400", detail: "RAM is rarely a degradation issue; utilisation is measured but rarely causes hardware failure." },
  { name: "CPU", weight: 10, icon: Cpu, color: "text-green-400", detail: "Load and throttle events are captured but thermal scoring already accounts for the primary CPU risk signal." },
];

const statusThresholds = [
  { label: "Healthy", range: "≥ 80", color: "bg-green-500/20 text-green-400 border-green-500/40", description: "Within normal operating parameters. No action required." },
  { label: "Watch", range: "60 – 79", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40", description: "Measurable degradation is present. Worth monitoring each week." },
  { label: "Attention", range: "40 – 59", color: "bg-orange-500/20 text-orange-400 border-orange-500/40", description: "Clear degradation. Action recommended within the next 1–3 months." },
  { label: "Critical", range: "< 40", color: "bg-red-500/20 text-red-400 border-red-500/40", description: "Failure risk is high. Immediate action required." },
];

const formulas = [
  {
    component: "Battery",
    icon: Battery,
    color: "text-primary",
    formula: "score = health%",
    caveats: [
      "If (expected_health_for_cycles − reported_health) > 10 → subtract up to 20 points",
      "Score clamped to [30, 100]",
      "expected_health = exponential decay curve fitted to population data: 100 × exp(−0.00042 × cycles)",
    ],
    example: "Battery at 72% health, 380 cycles. Expected: ~86%. Gap = 14. Penalty = min(20, 14−10) = 4. Score = 72 − 4 = 68 → Watch.",
  },
  {
    component: "Thermals",
    icon: Thermometer,
    color: "text-amber-400",
    formula: "score = step(maxTempC) − throttle_penalty",
    caveats: [
      "≤ 75°C → 100, > 75 → 80, > 80 → 65, > 85 → 50, > 90 → 30, > 95 → 10",
      "Throttle penalty: > 3 events → −5, > 10 → −10, > 20 → −20",
      "Score clamped to [0, 100]",
    ],
    example: "Peak 83°C, 7 throttle events → step=65, penalty=10 → Score = 55 → Attention.",
  },
  {
    component: "Storage",
    icon: HardDrive,
    color: "text-accent",
    formula: "score = wearLevelPct (or healthPct) − realloc_penalty − free_space_penalty",
    caveats: [
      "If S.M.A.R.T. wear not available: NVMe fallback caps at 95",
      "Realloc penalty: sectors × 5, capped at 40 points",
      "Free space penalty: < 5% → −20, < 10% → −10, < 15% → −5",
    ],
    example: "SSD at 74% wear remaining, 0 realloc sectors, 22% free → Score = 74 → Watch.",
  },
  {
    component: "Memory",
    icon: Database,
    color: "text-violet-400",
    formula: "score = step(usedPct)",
    caveats: [
      "≤ 70% used → 100, > 70 → 75, > 80 → 55, > 90 → 35",
    ],
    example: "16 GB RAM, 78% utilised → Score = 75 → Watch.",
  },
  {
    component: "CPU",
    icon: Cpu,
    color: "text-green-400",
    formula: "score = 100 − load_penalty − throttle_penalty",
    caveats: [
      "Load penalty: > 70% avg → −10, > 85% → −20",
      "Throttle penalty: > 3 events → −8, > 10 → −15, > 20 → −25",
    ],
    example: "75% avg load, 12 throttle events → 100 − 10 − 15 = 75 → Watch.",
  },
];



function InteractiveCalculator() {
  const [cycles, setCycles] = useState(380);
  const [health, setHealth] = useState(72);
  const [maxTemp, setMaxTemp] = useState(83);
  const [throttles, setThrottles] = useState(7);
  const [wearLevel, setWearLevel] = useState(74);
  const [realloc, setRealloc] = useState(0);

  // Battery logic
  const expected = 100 * Math.exp(-0.00042 * cycles);
  const gap = Math.max(0, expected - health);
  const batPenalty = gap > 10 ? Math.min(20, gap - 10) : 0;
  const batScore = Math.max(30, Math.min(100, Math.round(health - batPenalty)));

  // Thermal logic
  let tempStep = 100;
  if (maxTemp > 95) tempStep = 10;
  else if (maxTemp > 90) tempStep = 30;
  else if (maxTemp > 85) tempStep = 50;
  else if (maxTemp > 80) tempStep = 65;
  else if (maxTemp > 75) tempStep = 80;
  
  let thermPenalty = 0;
  if (throttles > 20) thermPenalty = 20;
  else if (throttles > 10) thermPenalty = 10;
  else if (throttles > 3) thermPenalty = 5;
  
  const thermScore = Math.max(0, Math.min(100, tempStep - thermPenalty));

  // Storage logic
  const reallocPenalty = Math.min(40, realloc * 5);
  const storeScore = Math.max(0, Math.min(100, wearLevel - reallocPenalty));

  return (
    <div className="surface-card rounded-2xl p-6 md:p-8 border border-primary/30 relative overflow-hidden mt-8">
      <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
        <Calculator className="w-24 h-24" />
      </div>
      
      <h3 className="text-xl font-bold mb-2 flex items-center gap-2 relative z-10">
        <Calculator className="w-5 h-5 text-primary" />
        Interactive Score Calculator
      </h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-2xl relative z-10">
        Adjust the raw telemetry values below to see exactly how Sentinel computes scores in real time. 
        This is the exact same logic running on our servers.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        {/* Battery Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Battery className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">Battery</span>
          </div>
          
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cycle Count</label>
            <input type="range" min="0" max="1500" value={cycles} onChange={e => setCycles(Number(e.target.value))} className="w-full accent-primary" />
            <div className="text-right text-xs font-mono">{cycles} cycles</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Reported Health %</label>
            <input type="range" min="10" max="100" value={health} onChange={e => setHealth(Number(e.target.value))} className="w-full accent-primary" />
            <div className="text-right text-xs font-mono">{health}%</div>
          </div>
          
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 text-xs font-mono">
            <div>Expected: {expected.toFixed(1)}%</div>
            <div>Gap: {gap.toFixed(1)}</div>
            <div>Penalty: -{batPenalty.toFixed(0)}</div>
            <div className="text-primary font-bold mt-2 text-lg">Score: {batScore}</div>
          </div>
        </div>

        {/* Thermals Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-foreground">Thermals</span>
          </div>
          
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Temp (°C)</label>
            <input type="range" min="40" max="105" value={maxTemp} onChange={e => setMaxTemp(Number(e.target.value))} className="w-full accent-amber-400" />
            <div className="text-right text-xs font-mono">{maxTemp}°C</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Throttle Events (30m)</label>
            <input type="range" min="0" max="30" value={throttles} onChange={e => setThrottles(Number(e.target.value))} className="w-full accent-amber-400" />
            <div className="text-right text-xs font-mono">{throttles} events</div>
          </div>
          
          <div className="bg-amber-400/5 rounded-lg p-3 border border-amber-400/20 text-xs font-mono">
            <div>Temp Step: {tempStep}</div>
            <div>Penalty: -{thermPenalty}</div>
            <div className="text-amber-400 font-bold mt-2 text-lg">Score: {thermScore}</div>
          </div>
        </div>

        {/* Storage Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-accent" />
            <span className="font-semibold text-foreground">Storage</span>
          </div>
          
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Wear Level / Health %</label>
            <input type="range" min="10" max="100" value={wearLevel} onChange={e => setWearLevel(Number(e.target.value))} className="w-full accent-accent" />
            <div className="text-right text-xs font-mono">{wearLevel}%</div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Reallocated Sectors</label>
            <input type="range" min="0" max="20" value={realloc} onChange={e => setRealloc(Number(e.target.value))} className="w-full accent-accent" />
            <div className="text-right text-xs font-mono">{realloc}</div>
          </div>
          
          <div className="bg-accent/5 rounded-lg p-3 border border-accent/20 text-xs font-mono">
            <div>Base: {wearLevel}</div>
            <div>Penalty: -{reallocPenalty}</div>
            <div className="text-accent font-bold mt-2 text-lg">Score: {storeScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Scoring() {
  return (
    <div className="px-6 py-20">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <AnimateIn>
          <div className="mb-16">
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
              OPEN METHODOLOGY
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mt-4 mb-6">
              How Sentinel scores{" "}
              <span className="gradient-text">your hardware.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Every number Sentinel produces is derived from a documented formula. No machine learning. No black box. You can reproduce any score by hand from your raw hardware data.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span className="font-mono text-primary">ALGO_VERSION = 1</span>
              <span>·</span>
              <span>Last updated May 2026</span>
              <span>·</span>
              <Link href="/changelog" className="text-primary hover:underline flex items-center gap-1">
                Changelog <ArrowRight className="w-3 h-3" />
              </Link>
              <span>·</span>
              <Link href="/how-it-works" className="text-primary hover:underline flex items-center gap-1">
                How the agent works <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </AnimateIn>

        {/* Overall score formula */}
        <AnimateIn delay={0.05}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Overall health score
            </h2>
            <div className="surface-card rounded-xl p-6 font-mono text-sm border border-primary/20">
              <div className="text-muted-foreground mb-2">// Weighted average of component scores</div>
              <div className="text-foreground leading-loose">
                <span className="text-primary">overall</span> = round(
                <br />
                &nbsp;&nbsp;(Battery × 0.30 + Thermals × 0.25 + Storage × 0.25 + Memory × 0.10 + CPU × 0.10)
                <br />
                &nbsp;&nbsp;÷ sum_of_weights_for_present_components
                <br />
                )
              </div>
              <div className="text-muted-foreground mt-3 text-xs">
                // Missing components (e.g. no battery data) are omitted; remaining weights are renormalised.
              </div>
            </div>
          </section>
        </AnimateIn>

        {/* Component weights */}
        <AnimateIn delay={0.08}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <GitCommit className="w-5 h-5 text-primary" />
              Component weights &amp; rationale
            </h2>
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4" staggerDelay={0.06}>
              {componentWeights.map((c) => (
                <StaggerItem key={c.name}>
                  <div className="surface-card rounded-xl p-5 border border-border/60 hover:border-primary/30 transition-colors h-full">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <c.icon className={`w-4 h-4 ${c.color}`} />
                        <span className="font-semibold text-foreground">{c.name}</span>
                      </div>
                      <span className={`text-2xl font-bold font-mono ${c.color}`}>{c.weight}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.detail}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>
        </AnimateIn>

        {/* Status thresholds */}
        <AnimateIn delay={0.1}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Status thresholds
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {statusThresholds.map((s) => (
                <div key={s.label} className={`rounded-xl p-5 border ${s.color} bg-opacity-10`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{s.label}</span>
                    <span className="font-mono text-sm">{s.range}</span>
                  </div>
                  <p className="text-xs opacity-80 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </section>
        </AnimateIn>

        {/* Grade mapping */}
        <AnimateIn delay={0.12}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-4">Grade mapping</h2>
            <div className="surface-card rounded-xl p-6 font-mono text-sm border border-border/60">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-muted-foreground text-xs uppercase tracking-widest border-b border-border/60">
                    <th className="pb-3 pr-8">Grade</th>
                    <th className="pb-3 pr-8">Label</th>
                    <th className="pb-3">Score range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {[
                    { grade: "A", label: "Excellent", range: "80 – 100", color: "text-green-400" },
                    { grade: "B", label: "Good",      range: "65 – 79",  color: "text-primary" },
                    { grade: "C", label: "Fair",      range: "55 – 64",  color: "text-yellow-400" },
                    { grade: "D", label: "Poor",      range: "40 – 54",  color: "text-orange-400" },
                    { grade: "F", label: "Critical",  range: "0 – 39",   color: "text-red-400" },
                  ].map((r) => (
                    <tr key={r.grade}>
                      <td className={`py-2.5 pr-8 font-bold text-lg ${r.color}`}>{r.grade}</td>
                      <td className="py-2.5 pr-8 text-foreground">{r.label}</td>
                      <td className="py-2.5 text-muted-foreground">{r.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </AnimateIn>

        {/* Per-component formulas */}
        <AnimateIn delay={0.14}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-6">Per-component scoring formulas</h2>
            <StaggerContainer className="space-y-6" staggerDelay={0.4}>
              {formulas.map((f) => (
                <StaggerItem key={f.component}>
                  <div className="surface-card rounded-xl p-6 border border-border/60 hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                      <h3 className="font-semibold text-foreground">{f.component}</h3>
                    </div>
                    <div className="font-mono text-sm bg-background/60 rounded-lg px-4 py-3 border border-border/40 mb-4 hover:border-primary/40 hover:bg-muted/10 transition-colors group">
                      <span className="text-primary group-hover:text-primary/80 transition-colors">score</span>{" "}
                      <span className="text-muted-foreground">= </span>
                      <span className="text-foreground">{f.formula}</span>
                    </div>
                    <ul className="space-y-1 mb-4">
                      {f.caveats.map((c, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2 group-hover:text-muted-foreground/80 transition-colors">
                          <span className="text-primary mt-0.5">·</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="text-xs text-muted-foreground/70 bg-card/50 rounded-lg px-4 py-3 border border-border/30 font-mono leading-relaxed hover:border-primary/30 transition-colors">
                      Example: {f.example}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>
        </AnimateIn>

                {/* Interactive Calculator */}
        <AnimateIn delay={0.16}>
          <section className="mb-16">
            <InteractiveCalculator />
          </section>
        </AnimateIn>

        {/* Forecast honesty note */}
        <AnimateIn delay={0.16}>
          <section className="mb-16">
            <h2 className="text-xl font-bold mb-4">Health forecast timelines</h2>
            <div className="surface-card rounded-xl p-6 border border-amber-500/20 bg-amber-500/5">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Sentinel shows projected timelines — e.g. "battery may become unreliable in 8–14 months." These are estimates, not guarantees. Here's how they are produced:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5 shrink-0">→</span>
                  <span><strong className="text-foreground">Cold start (fewer than 3 scans):</strong> projections use a population degradation curve fitted to published manufacturer data. The forecast label clearly states this is population-based.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  <span><strong className="text-foreground">Warm (3+ scans from your device):</strong> projections use linear regression on your own scan history, with a 95% confidence interval displayed. The label clearly states how many data points the model used.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5 shrink-0">→</span>
                  <span>All forecast intervals are rounded to the nearest month and displayed as a range, never a single number presented as certain.</span>
                </li>
              </ul>
            </div>
          </section>
        </AnimateIn>

        {/* CTA */}
        <AnimateIn delay={0.18}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
            >
              See a sample report
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all duration-200"
            >
              How the agent works
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </AnimateIn>

      </div>
    </div>
  );
}
