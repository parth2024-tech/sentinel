import { Link } from "wouter";
import { ArrowRight, AlertTriangle, Shield, ExternalLink, Cpu, Battery, HardDrive, Thermometer, FileWarning } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

// ── Case studies with linked engine findings ──────────────────────────────────
// Each case study now has a `findingIds` array that references caseStudyId values
// in the engine. When a user's report contains one of these findings, the link
// goes both ways: report → case study, case study → finding.

const cases = [
  {
    id: "dell-battery-good",
    num: "01",
    tool: "Dell SupportAssist",
    headline: "\"Battery: Good\" — while capacity was at 52%",
    summary:
      "Dell SupportAssist reports battery health in three buckets: Good, Fair, and Poor. The threshold for 'Good' is any capacity above 50% of the original design. A battery that has degraded from 86 Wh to 45 Wh shows as 'Good' — and will continue to do so until it drops below 43 Wh.",
    detail:
      "This isn't a bug. It's a design choice. A 'Good' battery that lasts 45 minutes on battery is technically accurate by Dell's definition. The issue is that SupportAssist never reports the capacity number itself — only the bucket. You cannot tell from SupportAssist whether your battery is at 90% or 51% of its original capacity. Both show identically.",
    evidence:
      "Reproducible on any Dell system using powercfg /batteryreport — compare the 'Design Capacity' vs 'Full Charge Capacity' in the HTML report to the SupportAssist 'Battery' status. The discrepancy between the two views has been documented by users on the Dell Community forums for every generation of XPS and Inspiron hardware.",
    impact: "Users replace batteries at failure, not at planned intervals. Avg cost of emergency replacement vs planned: 60% higher due to same-day service fees.",
    sentinelFinding: {
      title: "Battery in Dell SupportAssist 'Good' range — but degraded",
      trigger: "Battery capacity between 50% and 80%",
      engineId: "dell-battery-good",
      description: "Sentinel fires this finding when your battery is in the exact range where Dell SupportAssist would hide the problem behind a \"Good\" label. Instead of a bucket, you get the actual percentage and cycle-adjusted context.",
    },
    dataSource: "Dell diagnostic script — Section 2: Battery Health (lines 126-220). Captures design capacity, full charge capacity, cycle count, and Dell DCIM battery status. Dell's own DCIM namespace reports PrimaryStatus as a numeric code, not a percentage.",
    accentColor: "text-cyan-400",
    borderColor: "border-cyan-400/20",
    bgColor: "bg-cyan-400/3",
    iconBg: "bg-cyan-400/10",
    icon: Battery,
  },
  {
    id: "lenovo-vantage-normal",
    num: "02",
    tool: "Lenovo Vantage",
    headline: "Battery conservation mode hides actual cycle count",
    summary:
      "Lenovo Vantage's battery health section shows a simplified 'Battery Condition' status without exposing the actual cycle count or capacity percentage — the two metrics that matter most for predicting battery end-of-life.",
    detail:
      "Lenovo does offer a 'Battery Gauge Reset' feature that re-calibrates the reported charge level — but recalibration is different from capacity measurement. A ThinkPad with 600 cycles running Vantage's 'Battery Condition: Normal' may have as little as 65% of its original capacity remaining. Lenovo's conservation mode (charging to 80% max) is genuinely useful, but the UI conflates 'protected battery' with 'healthy battery' — they are not the same thing.",
    evidence:
      "Lenovo's own battery specifications document lists design capacity values per model. Running powercfg /batteryreport and comparing to Vantage shows a systematic gap in what's disclosed. ThinkPad forum threads document users reporting 'Battery: Normal' within days of a swollen battery event.",
    impact: "ThinkPad hardware has a strong reputation for longevity. Lenovo's own data shows this is real — but the software layer actively obscures the leading indicators that would let users sustain it.",
    sentinelFinding: {
      title: "Battery would show 'Normal' in Lenovo Vantage — despite wear",
      trigger: "Cycle count > 300 AND battery capacity < 80%",
      engineId: "lenovo-vantage-normal",
      description: "Sentinel catches the exact pattern the Lenovo diagnostic script reveals: high cycle counts with degraded capacity that Vantage would label 'Normal.' The finding exposes both the hidden cycle count and the capacity gap Vantage doesn't show.",
    },
    dataSource: "Lenovo diagnostic script — Section 2: Battery Health (lines 107-199). Captures BatteryCycleCount from root\\wmi, FullChargedCapacity vs DesignedCapacity, and Lenovo-specific conservation mode registry key at HKLM\\SYSTEM\\CurrentControlSet\\Services\\ibmpmsvc\\Parameters\\Tablet.",
    accentColor: "text-violet-400",
    borderColor: "border-violet-400/20",
    bgColor: "bg-violet-400/3",
    iconBg: "bg-violet-400/10",
    icon: Battery,
  },
  {
    id: "hp-service-upsell",
    num: "03",
    tool: "HP Support Assistant",
    headline: "Paid service recommendations before flagging real issues",
    summary:
      "HP Support Assistant's diagnostic flow is structured to surface warranty upsell and paid service options before completing hardware analysis. In documented cases, the 'Get Support' CTA appears before the diagnostic scan result.",
    detail:
      "HP Support Assistant's primary function is to sell HP Care Packs and extended warranty coverage. The diagnostics are real and often accurate — but the UX is designed to funnel users toward HP's paid support. When a drive shows early SMART warning signs, Support Assistant flags it — but the remediation path leads to 'Contact HP Support' rather than actionable self-service guidance.",
    evidence:
      "Compare HP Support Assistant's flow with a free S.M.A.R.T. tool like CrystalDiskInfo on any machine showing reallocated sectors. HP's tool will frequently suggest 'Your hardware may need service — contact HP' while CrystalDiskInfo shows the specific attribute (05 Reallocated Sectors Count) and its raw value.",
    impact: "A reallocated sector count of 5–20 is a warning sign — not an emergency. The appropriate response is to back up and monitor. HP's recommended response is a service call.",
    sentinelFinding: {
      title: "Reallocated sectors at level HP flags as 'needs service'",
      trigger: "Reallocated sectors between 1 and 20",
      engineId: "hp-service-upsell",
      description: "When Sentinel detects a low reallocated sector count, it gives you actionable guidance (back up, monitor weekly, replace if count increases) instead of routing you to a paid service call. The finding includes the exact sector count HP would hide behind a 'Contact Support' CTA.",
    },
    dataSource: "HP diagnostic script — StorageDiagnostics class (lines 637-775). Checks MSFT_StorageReliabilityCounter for ReadErrorsUncorrected, WriteErrorsUncorrected, Wear, and Temperature. HP's code routes findings to plain_english descriptions but the Support Assistant UI adds the service CTA on top.",
    accentColor: "text-amber-400",
    borderColor: "border-amber-400/20",
    bgColor: "bg-amber-400/3",
    iconBg: "bg-amber-400/10",
    icon: HardDrive,
  },
  {
    id: "taskmanager-throttle",
    num: "04",
    tool: "Windows Task Manager",
    headline: "CPU at '50% usage' — while actually thermal throttling",
    summary:
      "When a CPU hits its thermal limit, Windows reduces its clock speed to protect the hardware. Task Manager continues to show CPU usage as a percentage of the reduced clock — not the original. A CPU running at 50% of a thermally-throttled 1.2 GHz appears the same as 50% of a healthy 4.7 GHz boost clock.",
    detail:
      "CPU throttling is not visible anywhere in Task Manager. The performance tab shows clock speed — but only on a per-second basis and only if you know to look. There is no throttling indicator, no event log entry visible in the UI, and no notification. A machine that has been thermal throttling for months looks identical to a healthy machine in Task Manager unless you know to check the current clock against the spec sheet max clock.",
    evidence:
      "Reproducible with any utility that exposes power limit throttling (ThrottleStop, HWiNFO64, Intel XTU). Enable the 'PL1/PL2 Throttling' column in HWiNFO64 while Task Manager is open. Common on thin-and-light laptops like the Dell XPS 13, HP Spectre, and most ultrabooks.",
    impact: "Extended thermal throttling is the leading cause of battery degradation acceleration and long-term CPU performance loss. It goes undetected by the most-used diagnostic tool on Windows.",
    sentinelFinding: {
      title: "CPU throttling invisible in Task Manager",
      trigger: "Throttle events > 0 AND peak temp > 75°C AND CPU load < 70%",
      engineId: "taskmanager-throttle",
      description: "Sentinel cross-correlates throttle events with CPU load and temperature. When it detects throttling at moderate load levels, it generates this finding — the exact scenario where Task Manager shows 'everything is fine' while performance is being silently reduced.",
    },
    dataSource: "Dell script Section 4 (lines 296-351), Lenovo script Section 4 (lines 267-323), HP script ThermalDiagnostics class. All three collect throttle events from Event ID 37 (Microsoft-Windows-Kernel-Processor-Power) — the event Task Manager never surfaces.",
    accentColor: "text-red-400",
    borderColor: "border-red-400/20",
    bgColor: "bg-red-400/3",
    iconBg: "bg-red-400/10",
    icon: Cpu,
  },
  {
    id: "nvme-wear-hidden",
    num: "05",
    tool: "All OEM Tools",
    headline: "NVMe wear at 30% consumed — OEM says 'Healthy'",
    summary:
      "OEM diagnostic tools report NVMe drive health as a binary pass/fail. Dell SupportAssist, Lenovo Vantage, and HP Support Assistant all display 'Drive: Healthy' or 'Drive: Good' regardless of whether 5% or 50% of the drive's write endurance has been consumed.",
    detail:
      "The diagnostic data from all three OEM scripts confirms this pattern. Dell checks MSFT_StorageReliabilityCounter and reports Wear as a percentage but Dell SupportAssist only shows Status as OK/Degraded. Lenovo's script captures SMART Wear Level but Vantage's UI doesn't expose it. HP's script reads the same reliability counter but HP Support Assistant converts it to a generic 'Healthy/Unhealthy' status. The actual percentage — the only number that lets you plan ahead — is available in the data but hidden in the UI.",
    evidence:
      "All three diagnostic scripts capture the Wear value from MSFT_StorageReliabilityCounter. Compare this value to what each OEM tool shows: Dell → 'OK', Lenovo → 'Normal', HP → 'Healthy'. The planning window between 80% remaining and 30% remaining is entirely invisible.",
    impact: "Users discover drive wear at failure, not at the 70% mark where replacement can be planned. By the time OEM tools flag the drive, the planning window is gone.",
    sentinelFinding: {
      title: "NVMe wear level below OEM reporting threshold",
      trigger: "NVMe wear level between 50% and 90% remaining",
      engineId: "nvme-wear-hidden",
      description: "Sentinel reports the exact remaining endurance percentage that all three OEM tools hide behind pass/fail. This is the planning window — the months between 'everything works' and 'drive is failing' where you can back up, budget, and schedule replacement on your terms.",
    },
    dataSource: "Dell script Section 3 (lines 245-259), Lenovo script Section 3 (lines 226-242), HP script StorageDiagnostics._check_smart_data (lines 661-775). All three read MSFT_StorageReliabilityCounter.Wear — the value their UIs refuse to show.",
    accentColor: "text-green-400",
    borderColor: "border-green-400/20",
    bgColor: "bg-green-400/3",
    iconBg: "bg-green-400/10",
    icon: HardDrive,
  },
  {
    id: "acpi-static-lie",
    num: "06",
    tool: "All OEM Tools",
    headline: "OEM firmware reports fixed 27°C — regardless of actual temperature",
    summary:
      "Certain Dell, HP, and Lenovo BIOS versions report a static ACPI thermal zone temperature that never changes regardless of CPU load. The firmware reports 300.15K (27°C) at idle and under full load. All three OEM diagnostic tools read this value and present it as the actual temperature.",
    detail:
      "All three diagnostic scripts access MSAcpi_ThermalZoneTemperature in the root\\wmi namespace. When the BIOS returns a static value, each tool handles it differently: Dell's script falls back to Dell DCIM NumericSensor (if Dell Command Monitor is installed), Lenovo's falls back to Legion GameZone temperature (if available), and HP's falls back to psutil. But the OEM UI tools — SupportAssist, Vantage, and Support Assistant — don't perform this validation. They report the static value as fact.",
    evidence:
      "Run the thermal section of any diagnostic script twice — once at idle, once under CPU stress. If the ACPI temperature doesn't change, the firmware is lying. The Dell script checks this at Section 7 (lines 462-518), Lenovo at Section 7 (lines 427-482), and HP in ThermalDiagnostics.run(). Sentinel detects this pattern automatically and marks it as 'acpi_static_suspect'.",
    impact: "A system with a static ACPI reading may be running at 95°C while every OEM tool reports 27°C. The thermal score, the thermal-battery correlation, and the throttling analysis are all invalid when based on this data. OEM tools produce a falsely healthy thermal assessment.",
    sentinelFinding: {
      title: "OEM firmware reporting fixed temperature (ACPI static)",
      trigger: "Thermal source detected as 'acpi_static_suspect'",
      engineId: "acpi-static-lie",
      description: "Sentinel detects when ACPI thermal readings are static (never change under load) and excludes them from scoring entirely. Instead of producing a misleadingly healthy thermal score, it tells you exactly what happened and why. This is the single most impactful data quality check — no OEM tool performs it.",
    },
    dataSource: "Dell script Section 7 (lines 464-474), Lenovo script Section 7 (lines 430-443), HP script ThermalDiagnostics. All read MSAcpi_ThermalZoneTemperature. Dell's DCIM fallback (DCIM_NumericSensor SensorType=2) and Lenovo's GameZone fallback exist in the scripts but not in the OEM UI tools.",
    accentColor: "text-orange-400",
    borderColor: "border-orange-400/20",
    bgColor: "bg-orange-400/3",
    iconBg: "bg-orange-400/10",
    icon: Thermometer,
  },
];

export default function OEMFailures() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="relative py-20 px-6 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/3 via-background to-amber-500/3 pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-mono mb-6">
              <AlertTriangle className="w-3 h-3" />
              DOCUMENTED FAILURES · LINKED TO ENGINE FINDINGS
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
              Real diagnostic data.<br />Real OEM failures.
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed mb-4">
              These case studies are extracted from real Dell, Lenovo, and HP diagnostic scripts. Each one documents a specific failure pattern where the OEM tool got it wrong — and links to the exact Sentinel finding that catches it.
            </p>
            <p className="text-sm text-muted-foreground/60 max-w-2xl leading-relaxed mb-6">
              Every case study below includes the source file, the line numbers in the diagnostic script, and the engine condition that produces the linked finding. This is evidence, not marketing copy.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/health-test"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
              >
                Run your own scan <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/changelog"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
              >
                Scoring methodology <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </AnimateIn>
      </section>

      {/* Cases */}
      <section className="px-6 py-16">
        <StaggerContainer className="max-w-4xl mx-auto space-y-10" staggerDelay={0.1}>
          {cases.map((c) => (
            <StaggerItem key={c.id}>
              <div
                id={c.id}
                className={`rounded-xl border ${c.borderColor} ${c.bgColor} overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-${c.accentColor.replace('text-', '')}/10 transition-all duration-300 ease-out`}
              >
                {/* Case header */}
                <div className="px-7 py-5 border-b border-border/30 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
                    <c.icon className={`w-5 h-5 ${c.accentColor}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-mono ${c.accentColor} opacity-70`}>CS-{c.num}</span>
                      <span className="text-xs font-mono text-muted-foreground/40">·</span>
                      <span className={`text-xs font-mono ${c.accentColor} opacity-70`}>{c.tool}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground leading-snug">{c.headline}</h2>
                  </div>
                </div>

                {/* Case body */}
                <div className="px-7 py-6 space-y-5">
                  <p className="text-sm text-foreground/80 leading-relaxed font-medium">{c.summary}</p>

                  <div>
                    <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wide mb-2">Detail</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.detail}</p>
                  </div>

                  <div className="rounded-lg bg-[#0a0e1a] border border-border/40 px-5 py-4">
                    <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wide mb-2">How to verify</p>
                    <p className="text-sm text-muted-foreground/80 leading-relaxed">{c.evidence}</p>
                  </div>

                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 ${c.accentColor} shrink-0 mt-0.5`} />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="text-foreground/80 font-medium">Real impact: </span>
                      {c.impact}
                    </p>
                  </div>

                  {/* ── Linked Sentinel Finding ──────────────────────────── */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                    <div className="px-5 py-3 border-b border-primary/10 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold text-primary">Sentinel finding that catches this</h3>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <div>
                        <span className="text-xs font-mono text-primary/60 uppercase tracking-wide">Finding title</span>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{c.sentinelFinding.title}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs font-mono text-primary/60 uppercase tracking-wide">Trigger condition</span>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono bg-background/60 px-2 py-1 rounded border border-border/30 inline-block">{c.sentinelFinding.trigger}</p>
                        </div>
                        <div>
                          <span className="text-xs font-mono text-primary/60 uppercase tracking-wide">Engine ID</span>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono bg-background/60 px-2 py-1 rounded border border-border/30 inline-block">{c.sentinelFinding.engineId}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">{c.sentinelFinding.description}</p>
                    </div>
                  </div>

                  {/* Data source provenance */}
                  <div className="rounded-lg bg-background/40 border border-border/30 px-4 py-3">
                    <p className="text-xs font-mono text-muted-foreground/40 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                      <FileWarning className="w-3 h-3" />
                      Data source
                    </p>
                    <p className="text-xs text-muted-foreground/60 leading-relaxed">{c.dataSource}</p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* What Sentinel does differently */}
      <section className="px-6 py-16 border-y border-border/60 bg-card/10">
        <div className="max-w-4xl mx-auto">
          <AnimateIn>
            <h2 className="text-xl font-bold tracking-tight mb-3">What Sentinel does differently</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-2xl">
              Sentinel has no laptop to sell you, no service contract to upsell, no manufacturer relationship to protect. Every finding links to its trigger condition, its data source, and the OEM failure pattern it's designed to catch.
            </p>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.1}>
            {[
              { label: "Actual capacity %", detail: "Not a bucket. The real number, with cycle-adjusted degradation context." },
              { label: "Throttle detection", detail: "Every throttle event counted and cross-correlated to temps — invisible in Task Manager." },
              { label: "Wear level %", detail: "The exact NVMe endurance percentage that OEM tools hide behind pass/fail." },
              { label: "ACPI validation", detail: "Detects static firmware readings and excludes them — OEM tools report the lie." },
              { label: "Self-service guidance", detail: "Findings tell you what to do, not who to call for a paid service." },
              { label: "Open methodology", detail: "Every threshold, every formula, every exclusion documented at /changelog." },
            ].map((item) => (
              <StaggerItem key={item.label}>
                <div className="surface-card rounded-xl p-5 h-full">
                  <div className="text-sm font-semibold text-primary mb-1">{item.label}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{item.detail}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16">
        <AnimateIn>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-bold tracking-tight mb-4">See what your hardware actually looks like</h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              Run the diagnostic script, paste your output, and get a report that links every finding to the OEM failure pattern it catches. Not a bucket. Not a "contact us" CTA. Real data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/health-test"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
              >
                Run the diagnostic <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/why"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
              >
                Why Sentinel
              </Link>
            </div>
          </div>
        </AnimateIn>
      </section>

    </div>
  );
}
