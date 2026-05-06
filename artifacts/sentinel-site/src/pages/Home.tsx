import { Link } from "wouter";
import { motion } from "framer-motion";
import { Download, ArrowRight, Cpu, Battery, HardDrive, Thermometer, Wifi, AlertTriangle, CheckCircle, TrendingUp, Activity, FileCode } from "lucide-react";
import WaitlistForm, { WaitlistCount } from "@/components/WaitlistForm";
import HealthFeed from "@/components/HealthFeed";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";
import ParticleBackground from "@/components/ParticleBackground";
import HeroIllustration from "@/components/HeroIllustration";

const differentiators = [
  {
    icon: TrendingUp,
    title: "Diagnostic, not reactive",
    description: "Sentinel runs 40+ deterministic checks and surfaces degradation trends weeks before hardware fails — with the reasoning shown.",
    color: "text-primary",
  },
  {
    icon: CheckCircle,
    title: "Plain English only",
    description: "No cryptic codes or tech jargon. Every alert is a clear sentence a non-engineer can understand and act on.",
    color: "text-accent",
  },
  {
    icon: AlertTriangle,
    title: "Explainable scoring",
    description: "Every score is reproducible from your data. Same inputs always produce the same output. No black-box logic.",
    color: "text-primary",
  },
];

const featureHighlights = [
  { icon: Battery,     label: "Battery health tracking",     color: "text-primary" },
  { icon: HardDrive,   label: "SSD wear detection",          color: "text-accent" },
  { icon: Thermometer, label: "Thermal pattern analysis",    color: "text-primary" },
  { icon: Cpu,         label: "CPU load & throttle checks",  color: "text-accent" },
  { icon: Wifi,        label: "Network stability tracking",  color: "text-primary" },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative pt-24 pb-20 overflow-hidden px-6 text-center flex flex-col items-center min-h-[92vh] justify-center">
        {/* Background gradient & particles */}
        <ParticleBackground />
        
        <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Content Area */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <AnimateIn delay={0} direction="up">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-medium border border-primary/30 text-primary bg-primary/10 mb-8 shadow-sm backdrop-blur-md">
                <Activity className="w-3.5 h-3.5" /> REVEAL THE INVISIBLE
              </div>
            </AnimateIn>
            
            <AnimateIn delay={0.1} direction="up">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] relative">
                <span className="block mb-2">OEM diagnostics</span>
                <span className="block mb-2 text-muted-foreground/80 line-through decoration-red-500/50 decoration-[4px]">lie to you.</span>
                <span className="gradient-text mt-4 block">Sentinel shows the truth.</span>
              </h1>
            </AnimateIn>
            
            <AnimateIn delay={0.2} direction="up">
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mt-8">
                Stop relying on binary Pass/Fail checks that hide hardware degradation. 
                Our deterministic telemetry exposes exactly what is failing—down to the individual cycle—before your system dies.
              </p>
            </AnimateIn>
            
            <AnimateIn delay={0.4} direction="up" className="mt-12 w-full">
              <div className="flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-4 w-full">
                <Link href="/get-started" className="group relative flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-300 shadow-xl overflow-hidden min-w-[220px] animate-cta-pulse">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  <Download className="w-5 h-5 relative z-10" /> 
                  <span className="relative z-10">Run Sentinel Free</span>
                </Link>
                <Link href="/oem-failures" className="group flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all duration-300 min-w-[220px] backdrop-blur-sm bg-background/30 hover:bg-background/60">
                  See the OEM Evidence <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </AnimateIn>
          </div>

          {/* Right Illustration Area */}
          <div className="relative w-full aspect-square lg:aspect-auto h-full min-h-[400px] lg:min-h-[600px] flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="w-full h-full absolute inset-0"
            >
              <HeroIllustration />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Radical Transparency & Scroll Animations Section */}
      <section className="px-6 py-28 overflow-hidden bg-card/20 border-y border-border/60">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Radical transparency in every report</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                No guessing games. Watch exactly how your system is graded, component by component, with forecasted failure timelines based on real mathematical regressions.
              </p>
            </div>
          </AnimateIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Score Breakdown Scroll Animation */}
            <div className="space-y-8">
              <AnimateIn><h3 className="text-2xl font-bold">Component Breakdown</h3></AnimateIn>
              <StaggerContainer className="space-y-6" staggerDelay={0.15}>
                {[
                  { name: "Battery", score: 82, color: "bg-green-400 glow-green", text: "text-green-400" },
                  { name: "Thermals", score: 55, color: "bg-amber-400 glow-amber", text: "text-amber-400" },
                  { name: "Storage", score: 91, color: "bg-green-400 glow-green", text: "text-green-400" },
                  { name: "Memory", score: 74, color: "bg-green-400 glow-green", text: "text-green-400" }
                ].map((comp) => (
                  <StaggerItem key={comp.name} direction="left">
                    <div className="flex items-center gap-5">
                      <span className="w-24 text-base font-semibold text-muted-foreground">{comp.name}</span>
                      <div className="flex-1 h-3 bg-background border border-border/60 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className={`h-full ${comp.color}`}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${comp.score}%` }}
                          viewport={{ once: true, margin: "-100px" }}
                          transition={{ duration: 1.2, ease: "easeOut" }}
                        />
                      </div>
                      <span className={`w-12 text-right text-lg font-bold font-mono ${comp.text}`}>{comp.score}</span>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>

            {/* Forecast Timeline Scroll Animation */}
            <div className="space-y-8">
              <AnimateIn><h3 className="text-2xl font-bold">Forecast Timeline</h3></AnimateIn>
              <div className="p-8 rounded-2xl border border-border/50 bg-background/50 shadow-xl relative backdrop-blur-sm">
                {/* Graph lines */}
                <div className="absolute left-8 bottom-8 top-8 w-px bg-border/80" />
                <div className="absolute left-8 bottom-8 right-8 h-px bg-border/80" />
                
                <div className="relative h-48 w-full ml-4 overflow-hidden">
                  {/* Battery degradation line drawn left to right */}
                  <motion.svg 
                    className="absolute inset-0 w-full h-full overflow-visible" 
                    preserveAspectRatio="none"
                    viewBox="0 0 100 100"
                  >
                    <motion.path 
                      d="M 0,10 C 30,15 60,40 100,75" 
                      fill="none" 
                      stroke="var(--color-primary, #22d3ee)" 
                      strokeWidth="2.5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      whileInView={{ pathLength: 1, opacity: 1 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                    <motion.path 
                      d="M 0,10 C 30,15 60,40 100,75 L 100,100 L 0,100 Z" 
                      fill="url(#fadeGradient)"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 0.15 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                    <defs>
                      <linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary, #22d3ee)" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                  </motion.svg>
                  
                  {/* Projected fail point */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ delay: 1.2, duration: 0.4 }}
                    className="absolute right-0 bottom-[25%] flex items-center gap-2 translate-x-4 -translate-y-2"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-red-400 glow-red" />
                    <div className="text-xs font-mono font-bold text-red-400 bg-card px-2.5 py-1.5 border border-red-500/30 rounded-md">Fail Point</div>
                  </motion.div>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-6">Degradation trajectory modelled from 412 charge cycles.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof: Highlight public algorithm with inline formulas */}
      <section className="px-6 py-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <AnimateIn>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border border-primary/30 text-primary bg-primary/10 mb-6 font-semibold shadow-sm">
                  <FileCode className="w-3.5 h-3.5" /> FULLY OPEN ALGORITHM
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">No black-box AI.<br/>Reproducible by hand.</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  Trust isn't given, it's verified. Every Sentinel score is derived from a strict, versioned, and publicly documented mathematical formula. If you know your battery cycles and raw capacity, you can calculate the exact score yourself.
                </p>
                <Link href="/scoring" className="text-primary hover:text-primary/80 font-bold inline-flex items-center gap-1.5 transition-colors">
                  Read the full scoring methodology <ArrowRight className="w-4 h-4" />
                </Link>
              </AnimateIn>
            </div>
            
            {/* Code Snippet Window */}
            <AnimateIn delay={0.2} direction="left">
              <div className="rounded-xl border border-border/60 bg-[#0d1117] overflow-hidden shadow-2xl transition-all duration-200 ease-out hover:scale-[1.01] hover:border-primary/50 hover:shadow-[0_0_30px_-10px_rgba(34,211,238,0.3)]">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-[#161b22]">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="text-xs text-muted-foreground font-mono ml-2">engine.ts • v1.4.0</span>
                </div>
                <div className="p-6 font-mono text-[13px] leading-relaxed text-slate-300 overflow-x-auto">
                  <pre>
<code><span className="text-violet-400">export function</span> <span className="text-blue-400">batteryScore</span>(health: <span className="text-cyan-400">number</span>, cycles: <span className="text-cyan-400">number</span>) {'{'}
  <span className="text-slate-500">{"// 1. Get baseline expected health for this cycle count"}</span>
  <span className="text-violet-400">const</span> expected = <span className="text-blue-400">getExpectedHealth</span>(cycles);
  
  <span className="text-slate-500">{"// 2. Penalise if degradation is faster than the curve"}</span>
  <span className="text-violet-400">let</span> score = health;
  <span className="text-violet-400">const</span> gap = expected - health;
  
  <span className="text-violet-400">if</span> (gap {'>'} <span className="text-amber-400">10</span>) {'{'}
    score -= <span className="text-blue-400">Math</span>.<span className="text-blue-400">min</span>(<span className="text-amber-400">20</span>, gap - <span className="text-amber-400">10</span>);
  {'}'}
  
  <span className="text-violet-400">return</span> <span className="text-blue-400">clamp</span>(score, <span className="text-amber-400">30</span>, <span className="text-amber-400">100</span>);
{'}'}</code>
                  </pre>
                </div>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* OEM Failures Section Teaser */}
      <section className="px-6 py-28 bg-card/20 border-t border-border/60">
        <div className="max-w-7xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">The OEM Hall of Shame</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                We've documented exact cases where built-in diagnostic tools completely missed critical hardware degradation. Here's why you can't rely on pre-installed bloatware.
              </p>
            </div>
          </AnimateIn>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StaggerItem>
              <Link href="/oem-failures#dell" className="block h-full group">
                <div className="surface-card rounded-2xl p-8 h-full flex flex-col border border-border/50 group-hover:border-blue-500/50 hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)] transition-all duration-200 ease-out bg-background/40">
                  <div className="text-xs font-mono text-blue-400 mb-4 uppercase tracking-widest font-semibold">Case Study 01</div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Dell SupportAssist's 50% Lie</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    SupportAssist classifies battery health as "Good" anywhere from 50% to 100%. A battery operating at half its original runtime still receives a perfect pass.
                  </p>
                  <div className="mt-8 flex items-center gap-2 text-sm font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                    Read Case Study <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </StaggerItem>
            <StaggerItem>
              <Link href="/oem-failures#lenovo" className="block h-full group">
                <div className="surface-card rounded-2xl p-8 h-full flex flex-col border border-border/50 group-hover:border-red-500/50 hover:shadow-[0_0_30px_-10px_rgba(239,68,68,0.2)] transition-all duration-200 ease-out bg-background/40">
                  <div className="text-xs font-mono text-red-400 mb-4 uppercase tracking-widest font-semibold">Case Study 02</div>
                  <h3 className="text-xl font-bold text-foreground mb-4">Lenovo Vantage Hiding Cycles</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    Vantage displays a simple "Condition: Normal" status while actively concealing the actual cycle count and capacity percentage from the end user.
                  </p>
                  <div className="mt-8 flex items-center gap-2 text-sm font-bold text-red-400 group-hover:translate-x-1 transition-transform">
                    Read Case Study <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </StaggerItem>
            <StaggerItem>
              <Link href="/oem-failures#hp" className="block h-full group">
                <div className="surface-card rounded-2xl p-8 h-full flex flex-col border border-border/50 group-hover:border-cyan-400/50 hover:shadow-[0_0_30px_-10px_rgba(34,211,238,0.2)] transition-all duration-200 ease-out bg-background/40">
                  <div className="text-xs font-mono text-cyan-400 mb-4 uppercase tracking-widest font-semibold">Case Study 03</div>
                  <h3 className="text-xl font-bold text-foreground mb-4">HP's NVMe Wear Blindspot</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    HP Support Assistant only flags a failing NVMe drive when SMART errors trigger. It provides zero visibility into the drive's linear wear level consumption.
                  </p>
                  <div className="mt-8 flex items-center gap-2 text-sm font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                    Read Case Study <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Differentiators */}
      <section className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6" staggerDelay={0.1}>
            {differentiators.map((d) => (
              <StaggerItem key={d.title}>
                <div
                  className="surface-card rounded-xl p-8 flex flex-col gap-5 hover:border-primary/40 hover:scale-[1.01] hover:shadow-lg transition-all duration-200 ease-out group h-full"
                >
                  <div className={`w-10 h-10 rounded-lg bg-current/10 flex items-center justify-center ${d.color}`}>
                    <d.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{d.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{d.description}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="px-6 py-16 bg-card/20 border-y border-border/60">
        <div className="max-w-7xl mx-auto">
          <AnimateIn delay={0.1}>
            <div className="flex flex-wrap justify-center gap-3">
              {featureHighlights.map((f) => (
                <div
                  key={f.label}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm font-medium transition-all duration-150 hover:scale-[1.02] hover:border-primary/40 ${f.color}`}
                >
                  <f.icon className="w-4 h-4" />
                  <span className="text-foreground">{f.label}</span>
                </div>
              ))}
              <Link
                href="/what-it-monitors"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/40 text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
              >
                View all 12 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Live health feed */}
      <HealthFeed />

      {/* Waitlist section */}
      <section 
        className="px-6 py-28" 
        id="waitlist"
        style={{ background: 'linear-gradient(270deg, hsl(185 85% 55% / 0.03), hsl(265 70% 65% / 0.03), hsl(185 85% 55% / 0.03))', backgroundSize: '400% 400%', animation: 'gradient-shift 10s linear infinite' }}
      >
        <AnimateIn>
          <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-8">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto glow-cyan">
                <div className="w-3 h-3 rounded-full bg-primary animate-glow-pulse" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Be first to know.</h2>
              <p className="text-muted-foreground leading-relaxed">
                Sentinel is in private development. Join the waitlist and we'll notify you the moment early access opens.
              </p>
            </div>
            <div className="w-full max-w-md">
              <WaitlistForm />
              <div className="mt-3 flex justify-center">
                <WaitlistCount />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">No spam. No marketing. Just a launch notification.</p>
          </div>
        </AnimateIn>
      </section>
    </div>
  );
}
