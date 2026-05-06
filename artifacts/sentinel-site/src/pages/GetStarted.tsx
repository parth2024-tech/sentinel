import { useState } from "react";
import { Link } from "wouter";
import {
  Download, Zap, Terminal, ChevronDown, ArrowRight, Shield, Clock,
  RefreshCw, CheckCircle, User, Users, ChevronRight,
} from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";
import DownloadButton from "@/components/DownloadButton";
import { motion, AnimatePresence } from "framer-motion";

// ── Router answer types ───────────────────────────────────────────────────────

type UserType = "personal" | "fleet" | null;

// ── Routing screen ────────────────────────────────────────────────────────────

function RouterCard({
  icon: Icon,
  heading,
  sub,
  onClick,
  accent,
}: {
  icon: React.ElementType;
  heading: string;
  sub: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left surface-card rounded-2xl p-8 border border-border/60 hover:border-primary/50 transition-all duration-300 flex items-center gap-6 hover:shadow-[0_0_40px_-12px_var(--color-primary)]`}
    >
      <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shrink-0 ${accent} transition-all group-hover:scale-105`}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold text-foreground mb-1">{heading}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{sub}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
    </button>
  );
}

// ── Prerequisite + Steps inline in tier cards ─────────────────────────────────

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
          <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary mt-0.5">
            {i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function PrereqList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle className="w-3.5 h-3.5 text-green-400/70 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── Full tier card ────────────────────────────────────────────────────────────

function TierCard({
  tier,
  icon: Icon,
  label,
  tagline,
  timeEstimate,
  description,
  prereqs,
  steps,
  ctaSlot,
  recommended,
  accentClass,
  borderClass,
}: {
  tier: string;
  icon: React.ElementType;
  label: string;
  tagline: string;
  timeEstimate: string;
  description: string;
  prereqs: string[];
  steps: string[];
  ctaSlot: React.ReactNode;
  recommended?: boolean;
  accentClass: string;
  borderClass: string;
}) {
  return (
    <div
      className={`relative surface-card rounded-2xl p-8 flex flex-col gap-6 border transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_40px_-12px_var(--color-primary)] ${
        recommended
          ? "border-primary/50 shadow-[0_0_40px_-12px_var(--color-primary)]"
          : borderClass
      }`}
    >
      {recommended && (
        <div className="absolute -top-3 left-8">
          <span className="text-xs font-mono font-semibold px-3 py-1 rounded-full bg-primary text-background">
            RECOMMENDED FOR YOU
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${accentClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-mono text-muted-foreground mb-0.5">{tier}</p>
          <h3 className="text-xl font-bold text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{tagline}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 border border-border/40 rounded-full px-3 py-1 shrink-0">
          <Clock className="w-3 h-3" />
          {timeEstimate}
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

      {/* Prerequisites */}
      <div>
        <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
          What you need
        </p>
        <PrereqList items={prereqs} />
      </div>

      {/* Steps preview */}
      <div>
        <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest mb-3">
          What will happen
        </p>
        <StepList steps={steps} />
      </div>

      {/* CTA */}
      <div className="mt-auto pt-2">{ctaSlot}</div>
    </div>
  );
}

// ── Fleet notice ──────────────────────────────────────────────────────────────

function FleetNotice() {
  return (
    <div className="surface-card rounded-2xl p-6 border border-primary/20 bg-primary/3 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1">Fleet & organization onboarding</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            The Agent is the right tool for fleet management. Deploy it via Group Policy, SCCM, or Intune using the MSI with silent install flags. Each machine auto-registers to your org dashboard.
          </p>
          <div className="font-mono text-xs bg-background/60 border border-border/40 rounded-lg px-4 py-3 text-muted-foreground">
            <div className="text-muted-foreground/50 mb-1"># Silent MSI deploy via command line</div>
            <div className="text-cyan-400">msiexec /i SentinelSetup.msi /quiet <span className="text-slate-400">ORG_TOKEN=your-token</span></div>
          </div>
          <Link
            href="/pair"
            className="mt-3 inline-flex items-center gap-2 text-xs text-primary hover:underline underline-offset-4"
          >
            Read the org pairing guide <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GetStarted() {
  const [userType, setUserType] = useState<UserType>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const isPersonal = userType === "personal";
  const isFleet = userType === "fleet";

  return (
    <div className="px-6 py-20">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <AnimateIn>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
              GET STARTED
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mt-5 mb-4">
              Let's set up{" "}
              <span className="gradient-text">Sentinel</span>.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Answer two quick questions so we can show you the fastest path to your first report.
            </p>
          </div>
        </AnimateIn>

        {/* ── Routing questions ── */}
        <AnimateIn delay={0.05}>
          <div className="mb-12">
            <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest text-center mb-6">
              Who is this for?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RouterCard
                icon={User}
                heading="My personal machine"
                sub="I want to check the health of one laptop or desktop that I own."
                onClick={() => setUserType("personal")}
                accent={`bg-primary/10 border-primary/30 text-primary ${isPersonal ? "ring-2 ring-primary/40" : ""}`}
              />
              <RouterCard
                icon={Users}
                heading="Multiple machines / fleet"
                sub="I manage several devices for a team, org, or IT environment."
                onClick={() => setUserType("fleet")}
                accent={`bg-accent/10 border-accent/30 text-accent ${isFleet ? "ring-2 ring-accent/40" : ""}`}
              />
            </div>

            {userType && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setUserType(null)}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline underline-offset-4"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </AnimateIn>

        {/* ── Recommended path callout ── */}
        <AnimatePresence>
          {userType && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mb-8"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-foreground">
                  {isPersonal
                    ? "For personal use, we recommend the One-Shot Scan — no install, no account needed, report in under a minute. The Agent is a great upgrade if you want automated weekly scans."
                    : "For fleet management, the Sentinel Agent with org pairing is the right path. It deploys silently via MSI and auto-registers each machine to your dashboard."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Fleet-specific notice ── */}
        <AnimatePresence>
          {isFleet && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.3, ease: "easeOut" }}>
              <FleetNotice />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tier cards ── */}
        <StaggerContainer
          className={`grid grid-cols-1 gap-6 mb-8 ${isFleet ? "md:grid-cols-1 max-w-2xl mx-auto" : "md:grid-cols-2"}`}
          staggerDelay={0.08}
        >

          {/* Tier 2 — One-Shot (recommended for personal) */}
          {!isFleet && (
            <StaggerItem>
              <TierCard
                tier="TIER 2 · ONE-SHOT"
                icon={Zap}
                label="One-Shot Scan"
                tagline="Run once. Report opens in your browser."
                timeEstimate="~2 minutes"
                description="The fastest path to your first report. Double-click the executable — it scans, uploads, and opens your report automatically. Nothing stays installed."
                prereqs={[
                  "Windows 10 or 11 (64-bit)",
                  "Internet connection to upload report",
                  "One click to approve UAC prompt",
                ]}
                steps={[
                  "Download SentinelOneShot.exe from this page",
                  "Double-click — approve the single UAC prompt",
                  "Wait ~10 seconds while hardware is scanned",
                  "Your browser opens automatically to your report",
                  "The executable removes itself — nothing persists",
                ]}
                ctaSlot={<DownloadButton slug="oneshot" label="Download One-Shot Scan" recommended={isPersonal} />}
                recommended={isPersonal}
                accentClass="bg-accent/10 border-accent/30 text-accent"
                borderClass="border-border/40"
              />
            </StaggerItem>
          )}

          {/* Tier 1 — Agent (recommended for fleet, upgrade for personal) */}
          <StaggerItem>
            <TierCard
              tier="TIER 1 · AGENT"
              icon={Shield}
              label="Sentinel Agent"
              tagline="Install once. Weekly reports, automatically."
              timeEstimate="~4 minutes"
              description="A lightweight background service that scans on a schedule and uploads reports automatically. Your report is waiting in your browser before you've noticed it ran."
              prereqs={[
                "Windows 10 or 11 (64-bit)",
                "Admin rights to install the service",
                "Internet connection for upload & alerts",
                isFleet ? "Org token from your Sentinel dashboard" : "Email address for report notifications",
              ]}
              steps={[
                "Download SentinelSetup.msi from this page",
                "Run installer — approve UAC, enter your email",
                "Browser opens to pair the device to your account",
                "First report runs immediately and opens in browser",
                "Scheduled task runs every 7 days, you get an email",
                isFleet ? "Device appears in your org fleet dashboard" : "Trend tracking begins across future scans",
              ]}
              ctaSlot={
                <DownloadButton
                  slug="setup"
                  label="Download Sentinel Agent"
                  recommended={isFleet || (!userType)}
                />
              }
              recommended={isFleet}
              accentClass="bg-primary/10 border-primary/30 text-primary"
              borderClass="border-border/60"
            />
          </StaggerItem>
        </StaggerContainer>

        {/* ── Trust signals ── */}
        <AnimateIn delay={0.2}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
            {[
              { icon: Shield,    label: "Code-signed binary",    sub: "OV certificate — no SmartScreen friction" },
              { icon: Clock,     label: "~5–10 MB install size", sub: "No .NET runtime, no bundled JRE" },
              { icon: RefreshCw, label: "Standard uninstaller",  sub: "Add/Remove Programs — one click to remove" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-4 rounded-xl bg-muted/10 border border-border/30">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimateIn>

        {/* ── Legacy / Advanced PowerShell flow ── */}
        <AnimateIn delay={0.25}>
          <div className="border border-border/30 rounded-xl overflow-hidden mb-10">
            <button
              onClick={() => setLegacyOpen((o) => !o)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    TIER 3 — Advanced / IT admin
                  </span>
                  <span className="ml-3 text-xs font-mono text-muted-foreground/50">
                    PowerShell script paste-back · ~8 minutes
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${legacyOpen ? "rotate-180" : ""}`}
              />
            </button>

            {legacyOpen && (
              <div className="px-6 pb-6 pt-2 border-t border-border/30 bg-muted/5 space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  For locked-down corporate machines where executables are blocked by IT policy. You inspect the script, run it yourself, and paste the output into the web form.
                  Every manual step is a drop-off point — we recommend this only when the options above are not available.
                </p>

                {/* Prerequisites */}
                <div>
                  <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">What you need</p>
                  <PrereqList items={[
                    "PowerShell 5.1+ (built into Windows 10/11)",
                    "Execution policy that allows local scripts (or the Unblock-File workaround)",
                    "A browser to paste the output into",
                  ]} />
                </div>

                {/* Steps */}
                <div>
                  <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest mb-3">What will happen</p>
                  <StepList steps={[
                    "Download SentinelScan.ps1 from the links below",
                    "Run: Unblock-File .\\SentinelScan.ps1 in PowerShell",
                    "Run: .\\SentinelScan.ps1 — it copies a base64 JSON blob to your clipboard",
                    "Open /health-test, paste the blob into the editor, click Analyse",
                    "Your report generates instantly in the browser",
                  ]} />
                </div>

                <div className="rounded-lg bg-[#0a0e1a] border border-border/40 p-4 font-mono text-xs space-y-1">
                  <div className="text-muted-foreground/50"># Run in an elevated PowerShell window</div>
                  <div className="text-cyan-400">Unblock-File <span className="text-slate-300">.\\SentinelScan.ps1</span></div>
                  <div className="text-cyan-400">.\\SentinelScan.ps1 <span className="text-muted-foreground/50"># copies JSON to clipboard</span></div>
                  <div className="text-cyan-400">Start-Process <span className="text-slate-300">"https://sentinel.app/health-test"</span></div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                  {[
                    { href: "/scripts/sentinel-collect.ps1", label: "Generic script (.ps1)", filename: "sentinel-collect.ps1" },
                    { href: "/scripts/lenovo.ps1", label: "Lenovo script (.ps1)", filename: "sentinel-lenovo-diagnostic.ps1" },
                    { href: "/scripts/hp.py", label: "HP script (.py)", filename: "sentinel-hp-diagnostic.py" },
                  ].map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      download={s.filename}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> {s.label}
                    </a>
                  ))}
                  <Link
                    href="/health-test"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" /> Open paste-back form
                  </Link>
                </div>
              </div>
            )}
          </div>
        </AnimateIn>

        {/* ── Bottom CTA ── */}
        <AnimateIn delay={0.3}>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">Not ready to install anything?</p>
            <Link
              href="/sample-report"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4"
            >
              View a sample report first <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </AnimateIn>

      </div>
    </div>
  );
}
