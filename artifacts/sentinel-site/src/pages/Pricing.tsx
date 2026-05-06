import { Link } from "wouter";
import { ArrowRight, Check, X, Shield, Zap } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const FREE_FEATURES = [
  { label: "All 60+ hardware telemetry sources",   supported: true  },
  { label: "Real-time readings dashboard",          supported: true  },
  { label: "Battery cycle count & capacity",        supported: true  },
  { label: "SSD / NVMe S.M.A.R.T. monitoring",     supported: true  },
  { label: "Thermal zone temperature tracking",     supported: true  },
  { label: "Personal baseline learning",            supported: false, note: "Pro only — 7-day trial included" },
  { label: "Anomaly detection vs your normal",      supported: false, note: "Pro only"  },
  { label: "Cross-component correlation",           supported: false, note: "Pro only"  },
  { label: "Trend forecasting (30–90 day)",         supported: false, note: "Pro only"  },
  { label: "Weekly health report",                  supported: false, note: "Pro only"  },
  { label: "Plain-English alerts",                  supported: false, note: "Pro only"  },
  { label: "Habit coaching & usage patterns",       supported: false, note: "Pro only"  },
];

const PRO_FEATURES = [
  { label: "Everything in Free",                    supported: true  },
  { label: "Personal baseline learning",            supported: true  },
  { label: "Anomaly detection vs your normal",      supported: true  },
  { label: "Cross-component correlation",           supported: true  },
  { label: "Trend forecasting (30–90 day)",         supported: true  },
  { label: "Weekly health report (PDF export)",     supported: true  },
  { label: "Plain-English alerts & recommendations",supported: true  },
  { label: "Habit coaching & usage patterns",       supported: true  },
  { label: "Predictive failure timeline",           supported: true  },
  { label: "Priority support",                      supported: true  },
  { label: "Future features included",              supported: true  },
];

const FAQ_ITEMS = [
  {
    q: "Does Sentinel send my hardware data anywhere?",
    a: "No. All baseline learning, anomaly detection, and report generation happens on your machine. Sentinel makes no outbound calls during analysis. The only network activity is an anonymous license check once per day and an optional update check.",
  },
  {
    q: "What happens when my 7-day Pro trial ends?",
    a: "Sentinel rolls back to the Free tier automatically — no charge. Your baseline data is preserved, so if you upgrade later, learning picks up where it left off. No credit card is required to start the trial.",
  },
  {
    q: "Is there a discount for students or educators?",
    a: "Yes. Students and educators with a valid .edu email get 40% off Pro. Reach out through the waitlist form and mention your institution.",
  },
  {
    q: "Can I run Sentinel on multiple machines?",
    a: "One Pro license covers one machine. If you need coverage for a second device, each additional machine is 50% off the standard price.",
  },
  {
    q: "What Windows versions are supported?",
    a: "Sentinel runs on Windows 10 (build 1903+) and Windows 11. It requires no administrator elevation for normal operation — only the initial install needs admin rights.",
  },
  {
    q: "What if Sentinel doesn't detect anything useful?",
    a: "If Sentinel doesn't surface a meaningful insight within 30 days of Pro use, we'll refund you in full. No questions.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative py-20 px-6 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-background to-accent/4 pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono mb-6">
              PRICING
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
              Simple pricing.{" "}
              <span className="gradient-text">No surprises.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Start free. Upgrade when the predictions prove their worth. Cancel anytime — your baseline data stays on your machine regardless.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* Plans */}
      <section className="px-6 py-20">
        <StaggerContainer className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-start" staggerDelay={0.15}>

          {/* Free */}
          <StaggerItem>
            <div className="surface-card rounded-2xl p-8 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-muted/20 border border-border/60 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="font-semibold text-foreground">Free</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold tracking-tight">$0</span>
                <span className="text-muted-foreground text-sm pb-1.5">forever</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Full hardware telemetry access. The raw data, always free.
              </p>
            </div>

            <Link
              href="/waitlist"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
            >
              Download free
            </Link>

            <div className="space-y-3">
              {FREE_FEATURES.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  {f.supported ? (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center bg-green-500/10 shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 text-green-500" strokeWidth={2.5} />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center bg-muted/15 shrink-0 mt-0.5">
                      <X className="w-2.5 h-2.5 text-muted-foreground/30" strokeWidth={2.5} />
                    </div>
                  )}
                  <div>
                    <span className={`text-sm ${f.supported ? "text-foreground/90" : "text-muted-foreground/50"}`}>
                      {f.label}
                    </span>
                    {f.note && (
                      <span className="text-xs text-muted-foreground/40 ml-1.5">{f.note}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </StaggerItem>

          {/* Pro */}
          <StaggerItem>
            <div className="relative rounded-2xl p-8 flex flex-col gap-6 border border-primary/40 bg-gradient-to-b from-primary/5 to-transparent shadow-[0_0_40px_-8px] shadow-primary/20">
            {/* Popular badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <div className="px-4 py-1 rounded-full bg-primary text-background text-xs font-semibold font-mono tracking-wide">
                EARLY ACCESS PRICE
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="font-semibold text-foreground">Pro</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold tracking-tight text-primary">$4</span>
                <span className="text-muted-foreground text-sm pb-1.5">/ month</span>
                <span className="ml-2 text-sm text-muted-foreground/50 pb-1.5 line-through">$9</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Includes a <span className="text-foreground font-medium">7-day full Pro trial</span> — no credit card required to start.
              </p>
            </div>

            <Link
              href="/waitlist"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
            >
              Get early access
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="space-y-3">
              {PRO_FEATURES.map((f) => (
                <div key={f.label} className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center bg-primary/20 border border-primary/30 shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 text-primary" strokeWidth={2.5} />
                  </div>
                  <span className="text-sm text-foreground/90">{f.label}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
                30-day money-back guarantee if Sentinel doesn't surface a useful insight. No questions asked.
              </p>
            </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Billing note */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6 max-w-lg mx-auto leading-relaxed">
          Early access pricing is locked in for the life of your subscription. When Sentinel exits early access, the standard price increases — your rate stays the same.
        </p>
      </section>

      {/* What the intelligence unlocks */}
      <section className="px-6 py-16 border-y border-border/60 bg-card/10">
        <div className="max-w-4xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold tracking-tight mb-3">What Pro actually gives you</h2>
              <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                Free gives you raw data. Pro gives you meaning — the difference between knowing your battery is at 78% capacity and knowing it's degrading 3× faster than expected.
              </p>
            </div>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5" staggerDelay={0.1}>
            {[
              {
                before: "CPU temperature: 71°C",
                after: "71°C is 1.8 standard deviations above your idle baseline. Elevated for 6 consecutive days. Possible vent blockage or thermal paste degradation.",
                label: "From reading to diagnosis",
              },
              {
                before: "Battery capacity: 78.2%",
                after: "Capacity declining at 0.4%/week — 3× your first-year rate. At this rate, below 50% within 4 months. Consider a replacement before travel season.",
                label: "From number to timeline",
              },
              {
                before: "SSD free space: 9%",
                after: "Low space is compressing write performance. Combined with your workload pattern, this is likely contributing to the system slowdowns you've noticed on Thursdays.",
                label: "From metric to cause",
              },
            ].map((item) => (
              <StaggerItem key={item.label}>
                <div className="surface-card rounded-xl p-6 flex flex-col gap-4 h-full">
                  <span className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wide">{item.label}</span>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted/10 border border-border/40 px-4 py-3">
                      <p className="text-xs font-mono text-muted-foreground/60 mb-1">FREE</p>
                      <p className="text-sm text-muted-foreground">{item.before}</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/25 px-4 py-3">
                      <p className="text-xs font-mono text-primary/60 mb-1">PRO</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{item.after}</p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto">
          <AnimateIn>
            <h2 className="text-2xl font-bold tracking-tight mb-10 text-center">Common questions</h2>
          </AnimateIn>
          <div className="space-y-px">
            {FAQ_ITEMS.map((item, i) => (
              <details key={i} className="group surface-card rounded-none first:rounded-t-xl last:rounded-b-xl border-b border-border/40 last:border-0 overflow-hidden">
                <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer select-none list-none hover:bg-white/[0.01] transition-colors">
                  <span className="font-medium text-sm text-foreground">{item.q}</span>
                  <span className="w-5 h-5 rounded-full border border-border/60 flex items-center justify-center shrink-0 text-muted-foreground group-open:rotate-45 transition-transform duration-200">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </span>
                </summary>
                <div className="px-6 pb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-16 border-t border-border/60 bg-card/5">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-4">
            Start with the 7-day Pro trial.
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed text-sm">
            No credit card. No commitment. If Sentinel doesn't tell you something about your laptop you didn't already know, you lose nothing.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
            >
              Join the waitlist
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/compare"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
            >
              See the full comparison
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
