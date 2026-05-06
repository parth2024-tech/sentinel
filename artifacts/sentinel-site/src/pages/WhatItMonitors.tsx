import { Link } from "wouter";
import { Battery, HardDrive, Cpu, MemoryStick, Monitor, Thermometer, Fan, Zap, Play, Server, Wifi, Settings2, ArrowRight } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const subsystems = [
  {
    icon: Battery,
    name: "Battery",
    description: "Tracks capacity fade, charge cycle count, and discharge rate anomalies. Warns you weeks before your battery becomes unreliable.",
    color: "text-primary",
  },
  {
    icon: HardDrive,
    name: "SSD",
    description: "Monitors write amplification, wear leveling, bad sector emergence, and SMART degradation signals.",
    color: "text-accent",
  },
  {
    icon: Cpu,
    name: "CPU",
    description: "Watches for abnormal load patterns, clock speed inconsistencies, and performance throttling that shouldn't be happening.",
    color: "text-primary",
  },
  {
    icon: MemoryStick,
    name: "RAM",
    description: "Detects early memory errors, unusual pressure, and allocation failures that indicate module degradation.",
    color: "text-accent",
  },
  {
    icon: Monitor,
    name: "GPU",
    description: "Tracks driver stability, rendering errors, and thermal behavior under graphics load.",
    color: "text-primary",
  },
  {
    icon: Thermometer,
    name: "Thermals",
    description: "Monitors temperature trends across components — catching sustained overheating patterns before they shorten hardware life.",
    color: "text-accent",
  },
  {
    icon: Fan,
    name: "Fans",
    description: "Detects bearing wear, RPM irregularities, and fan speed anomalies before they lead to a thermal failure.",
    color: "text-primary",
  },
  {
    icon: Zap,
    name: "Power delivery",
    description: "Watches for voltage fluctuations, charging irregularities, and power draw anomalies that can signal adapter or motherboard issues.",
    color: "text-accent",
  },
  {
    icon: Play,
    name: "Startup health",
    description: "Tracks boot times and startup service behavior over time. Slow creep in startup duration is often the first sign of deeper issues.",
    color: "text-primary",
  },
  {
    icon: Server,
    name: "Memory pressure",
    description: "Monitors paging frequency and memory compression rates — signals that your system is struggling more than it should.",
    color: "text-accent",
  },
  {
    icon: Wifi,
    name: "Network stability",
    description: "Detects driver-level instability, packet loss patterns, and connection drops that suggest adapter degradation.",
    color: "text-primary",
  },
  {
    icon: Settings2,
    name: "Drivers",
    description: "Tracks driver crash events, version instability, and compatibility issues across your hardware stack.",
    color: "text-accent",
  },
];

export default function WhatItMonitors() {
  return (
    <div className="px-6 py-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <AnimateIn>
          <div className="max-w-2xl mb-20">
            <div className="mb-4">
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                COVERAGE
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6" data-testid="heading-what-it-monitors">
              12 subsystems.{" "}
              <span className="gradient-text">All the things that can fail.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Most hardware failures don't happen suddenly. They're preceded by weeks of subtle drift. Sentinel watches every system that matters.
            </p>
          </div>
        </AnimateIn>

        {/* Grid — staggered */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" staggerDelay={0.05}>
          {subsystems.map((s, i) => (
            <StaggerItem key={s.name}>
              <div
                className="surface-card rounded-xl p-6 flex flex-col gap-4 hover:border-primary/40 transition-all duration-300 group h-full"
                data-testid={`card-subsystem-${i}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-card border border-border/60 flex items-center justify-center ${s.color} group-hover:border-primary/40 transition-colors`}>
                    <s.icon className="w-4.5 h-4.5" strokeWidth={1.5} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{s.name}</h3>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-glow-pulse" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom note */}
        <AnimateIn delay={0.1}>
          <div className="mt-16 p-6 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Settings2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">You control what Sentinel monitors</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every subsystem can be individually enabled or disabled from the settings panel. If you only care about battery and SSD, you can run exactly that.
              </p>
            </div>
          </div>
        </AnimateIn>

        {/* CTA */}
        <AnimateIn delay={0.2}>
          <div className="mt-20 text-center">
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
              data-testid="button-monitors-waitlist"
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
