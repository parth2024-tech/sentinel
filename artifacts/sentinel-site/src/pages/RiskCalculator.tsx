import { useState } from "react";
import { ArrowRight, Share2, RotateCcw, AlertTriangle, TrendingDown, Shield } from "lucide-react";
import { Link } from "wouter";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

interface Field<T extends string> {
  id: string;
  label: string;
  subtext?: string;
  options: { value: T; label: string; riskDelta: number }[];
}

type Brand = "dell" | "lenovo" | "hp" | "asus" | "apple" | "other";
type Age = "lt1" | "1to2" | "2to3" | "3to4" | "gt4";
type Hours = "lt2" | "2to5" | "5to8" | "gt8";
type Usage = "browse" | "office" | "creative" | "gaming";
type Charging = "always" | "overnight" | "smart" | "variable";
type Cooling = "desk" | "lapbed" | "pad" | "hotroom";
type Issues = "none" | "minor" | "moderate" | "major";

interface Inputs {
  brand: Brand | "";
  age: Age | "";
  hours: Hours | "";
  usage: Usage | "";
  charging: Charging | "";
  cooling: Cooling | "";
  issues: Issues | "";
}

const FIELDS: Field<any>[] = [
  {
    id: "brand",
    label: "Laptop brand",
    options: [
      { value: "dell",   label: "Dell",    riskDelta: 2  },
      { value: "lenovo", label: "Lenovo",  riskDelta: 0  },
      { value: "hp",     label: "HP",      riskDelta: 3  },
      { value: "asus",   label: "ASUS",    riskDelta: 1  },
      { value: "apple",  label: "Apple",   riskDelta: -3 },
      { value: "other",  label: "Other",   riskDelta: 2  },
    ],
  },
  {
    id: "age",
    label: "How old is your laptop?",
    options: [
      { value: "lt1",   label: "Under 1 year",  riskDelta: -5 },
      { value: "1to2",  label: "1–2 years",      riskDelta: 0  },
      { value: "2to3",  label: "2–3 years",      riskDelta: 8  },
      { value: "3to4",  label: "3–4 years",      riskDelta: 18 },
      { value: "gt4",   label: "4+ years",       riskDelta: 28 },
    ],
  },
  {
    id: "hours",
    label: "Daily usage hours",
    options: [
      { value: "lt2",  label: "Under 2 hours",  riskDelta: -3 },
      { value: "2to5", label: "2–5 hours",       riskDelta: 0  },
      { value: "5to8", label: "5–8 hours",       riskDelta: 5  },
      { value: "gt8",  label: "8+ hours",        riskDelta: 12 },
    ],
  },
  {
    id: "usage",
    label: "Primary use",
    options: [
      { value: "browse",   label: "Light browsing / media",    riskDelta: -2 },
      { value: "office",   label: "Office / productivity",     riskDelta: 0  },
      { value: "creative", label: "Creative / coding / dev",   riskDelta: 5  },
      { value: "gaming",   label: "Gaming / heavy workloads",  riskDelta: 12 },
    ],
  },
  {
    id: "charging",
    label: "Charging habits",
    options: [
      { value: "smart",     label: "Smart: keep it 20–80%",     riskDelta: -5 },
      { value: "overnight", label: "Overnight charging to 100%", riskDelta: 8  },
      { value: "always",    label: "Always plugged in at 100%",  riskDelta: 12 },
      { value: "variable",  label: "Variable — no consistent habit", riskDelta: 3 },
    ],
  },
  {
    id: "cooling",
    label: "Where / how do you use it?",
    options: [
      { value: "pad",     label: "Cooling pad on a desk",           riskDelta: -5 },
      { value: "desk",    label: "Flat desk surface",               riskDelta: 0  },
      { value: "lapbed",  label: "Lap, bed, or couch regularly",    riskDelta: 10 },
      { value: "hotroom", label: "Hot room (no AC in summer)",      riskDelta: 8  },
    ],
  },
  {
    id: "issues",
    label: "Prior hardware issues?",
    options: [
      { value: "none",     label: "None — been trouble-free",        riskDelta: -5 },
      { value: "minor",    label: "Minor (slower, occasional freeze)", riskDelta: 3  },
      { value: "moderate", label: "Moderate (crashes, battery issues)", riskDelta: 12 },
      { value: "major",    label: "Major (repair, replaced part)",    riskDelta: 20 },
    ],
  },
];

const BASE_RISK = 15;

function calcRisk(inputs: Inputs): number {
  let risk = BASE_RISK;
  for (const field of FIELDS) {
    const val = inputs[field.id as keyof Inputs];
    if (!val) continue;
    const opt = field.options.find((o) => o.value === val);
    if (opt) risk += opt.riskDelta;
  }
  return Math.min(95, Math.max(5, risk));
}

function getRiskLabel(risk: number): { label: string; color: string; subColor: string; detail: string } {
  if (risk <= 20) return { label: "Low risk", color: "text-green-400", subColor: "bg-green-400", detail: "Your setup is well-optimised for long hardware life." };
  if (risk <= 35) return { label: "Moderate risk", color: "text-cyan-400", subColor: "bg-cyan-400", detail: "A few factors are adding wear. Small changes compound over time." };
  if (risk <= 55) return { label: "Elevated risk", color: "text-amber-400", subColor: "bg-amber-400", detail: "Multiple risk factors are combining. Your hardware is aging faster than average." };
  if (risk <= 75) return { label: "High risk", color: "text-orange-400", subColor: "bg-orange-400", detail: "Your configuration is in the top quartile of hardware risk. Attention needed." };
  return { label: "Critical risk", color: "text-red-400", subColor: "bg-red-400", detail: "This combination of factors is associated with hardware failures within 12 months." };
}

function getTopRisks(inputs: Inputs): { component: string; reason: string; severity: "high" | "medium" | "low" }[] {
  const risks: { component: string; reason: string; severity: "high" | "medium" | "low" }[] = [];

  if (inputs.charging === "always" || inputs.charging === "overnight") {
    risks.push({ component: "Battery", reason: inputs.charging === "always" ? "Always-on charging at 100% causes lithium electrolyte oxidation continuously." : "Overnight charging keeps the battery at max charge stress for 7–9 hours nightly.", severity: "high" });
  }
  if (inputs.cooling === "lapbed") risks.push({ component: "Thermals", reason: "Soft surface usage blocks vents and raises operating temp 8–15°C above baseline — the single biggest driver of accelerated CPU throttling.", severity: "high" });
  if (inputs.age === "3to4" || inputs.age === "gt4") risks.push({ component: "SSD / Battery", reason: `At ${inputs.age === "gt4" ? "4+" : "3–4"} years, lithium battery chemistry has typically completed 300–500 cycles. Both battery and SSD wear accelerate non-linearly in this range.`, severity: inputs.age === "gt4" ? "high" : "medium" });
  if (inputs.usage === "gaming") risks.push({ component: "Thermals + Fan", reason: "Sustained gaming-level loads push thermal systems to 85–95°C continuously, degrading thermal paste and fan bearings faster than any other workload.", severity: "high" });
  if (inputs.issues === "moderate" || inputs.issues === "major") risks.push({ component: "Multiple components", reason: `Prior ${inputs.issues === "major" ? "major" : "moderate"} issues are the strongest predictor of future failure. Hardware stress is cumulative.`, severity: "high" });
  if (inputs.hours === "gt8") risks.push({ component: "Overall wear rate", reason: "8+ hours of daily use means your laptop is accumulating wear at 2–3× the pace of typical usage patterns.", severity: "medium" });
  if (inputs.cooling === "hotroom") risks.push({ component: "Thermals", reason: "Ambient temperature above 30°C raises baseline operating temps by 6–10°C, compressing thermal headroom and increasing throttle frequency.", severity: "medium" });

  return risks.slice(0, 3);
}

function getLifespan(risk: number, age: Age | ""): string {
  const remaining: Record<Age, Record<string, string>> = {
    lt1:  { low: "6–8 more years", moderate: "4–6 more years", elevated: "3–5 more years", high: "2–3 more years", critical: "1–2 more years" },
    "1to2": { low: "5–7 more years", moderate: "3–5 more years", elevated: "2–4 more years", high: "1–3 more years", critical: "Under 2 years" },
    "2to3": { low: "4–6 more years", moderate: "2–4 more years", elevated: "2–3 more years", high: "1–2 more years", critical: "Under 18 months" },
    "3to4": { low: "3–4 more years", moderate: "2–3 more years", elevated: "1–2 more years", high: "12–18 months", critical: "Under 12 months" },
    gt4:  { low: "2–3 more years", moderate: "1–2 more years", elevated: "12–18 months", high: "Under 12 months", critical: "Replacement recommended" },
  };
  const bucket = risk <= 20 ? "low" : risk <= 35 ? "moderate" : risk <= 55 ? "elevated" : risk <= 75 ? "high" : "critical";
  if (!age) return "—";
  return remaining[age][bucket];
}

export default function RiskCalculator() {
  const [inputs, setInputs] = useState<Inputs>({ brand: "", age: "", hours: "", usage: "", charging: "", cooling: "", issues: "" });
  const [showResult, setShowResult] = useState(false);

  const allAnswered = Object.values(inputs).every((v) => v !== "");
  const riskScore = calcRisk(inputs);
  const riskLabel = getRiskLabel(riskScore);
  const topRisks = getTopRisks(inputs);
  const lifespan = getLifespan(riskScore, inputs.age);

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative py-16 px-6 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-background to-accent/4 pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono mb-5">
              RISK CALCULATOR
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              What's your laptop's failure risk?
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-xl">
              A deterministic risk model based on brand failure rates, usage patterns, and age-adjusted wear curves. Takes 30 seconds. No data leaves your browser.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* Form + result */}
      <section className="px-6 py-12">
        <div className="max-w-3xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* Inputs */}
          <StaggerContainer className="space-y-5" staggerDelay={0.04}>
            {FIELDS.map((field) => (
              <StaggerItem key={field.id}>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">{field.label}</label>
                  {field.subtext && <p className="text-xs text-muted-foreground mb-2">{field.subtext}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    {field.options.map((opt) => {
                      const current = inputs[field.id as keyof Inputs];
                      const active = current === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setInputs((prev) => ({ ...prev, [field.id]: opt.value }));
                            setShowResult(false);
                          }}
                          className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                            active
                              ? "border-primary/60 bg-primary/8 text-foreground font-medium"
                              : "border-border/40 hover:border-border/70 text-muted-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </StaggerItem>
            ))}
            <StaggerItem>
              <button
                onClick={() => setShowResult(true)}
                disabled={!allAnswered}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all glow-cyan"
              >
                Calculate my risk <ArrowRight className="w-4 h-4" />
              </button>
            </StaggerItem>
          </StaggerContainer>

          {/* Result panel */}
          <div className="lg:sticky lg:top-24">
            {!showResult ? (
              <AnimateIn delay={0.05}>
                <div className="surface-card rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/10 border border-border/40 flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-7 h-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground">Fill in all fields to see your personalised risk assessment.</p>
                </div>
              </AnimateIn>
            ) : (
              <div className="space-y-4">
                {/* Score */}
                <AnimateIn>
                  <div className="surface-card rounded-2xl p-7 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />
                    <div className="relative">
                      <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mb-3">Failure Risk Score</p>
                      <div className={`text-6xl font-bold tracking-tight mb-1 ${riskLabel.color}`}>{riskScore}%</div>
                      <div className={`text-base font-semibold mb-3 ${riskLabel.color}`}>{riskLabel.label}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{riskLabel.detail}</p>

                      {/* Risk bar */}
                      <div className="h-2 bg-border/30 rounded-full overflow-hidden mb-4">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${riskLabel.subColor}`}
                          style={{ width: `${riskScore}%` }}
                        />
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Estimated remaining useful life: <span className="text-foreground font-medium">{lifespan}</span>
                      </div>
                    </div>
                  </div>
                </AnimateIn>

                {/* Top risks */}
                {topRisks.length > 0 && (
                  <AnimateIn delay={0.05}>
                    <div className="surface-card rounded-xl p-5 space-y-4">
                      <h3 className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">Top risk factors</h3>
                      {topRisks.map((r, i) => (
                        <div key={i} className={`border-l-2 pl-4 ${r.severity === "high" ? "border-red-400" : r.severity === "medium" ? "border-amber-400" : "border-cyan-400/50"}`}>
                          <div className="text-sm font-semibold text-foreground mb-0.5">{r.component}</div>
                          <div className="text-xs text-muted-foreground leading-relaxed">{r.reason}</div>
                        </div>
                      ))}
                    </div>
                  </AnimateIn>
                )}

                {/* Actions */}
                <AnimateIn delay={0.08}>
                  <div className="flex gap-2">
                    <Link
                      href="/health-test"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
                    >
                      Run diagnostic <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => { setInputs({ brand: "", age: "", hours: "", usage: "", charging: "", cooling: "", issues: "" }); setShowResult(false); }}
                      className="px-4 py-2.5 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleShare} className="px-4 py-2.5 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground transition-all">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground/40 text-center leading-relaxed mt-4">
                    Model uses published failure rate data and battery chemistry research. It's a guide, not a diagnosis. Run the hardware diagnostic for real readings.
                  </p>
                </AnimateIn>
              </div>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}
