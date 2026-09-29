import { Battery, HardDrive, Cpu, Shield, AlertTriangle, CheckCircle2, Activity } from "lucide-react";

export default function HeroIllustration() {
  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col gap-4 text-left select-none">
      {/* Console Frame */}
      <div className="rounded-2xl border border-border/80 bg-[#0b0f19]/90 shadow-2xl p-6 backdrop-blur-xl relative overflow-hidden">
        {/* Top telemetry bar */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-border/40 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-foreground font-semibold">SENTINEL ENGINE v3</span>
            <span className="text-muted-foreground/60">|</span>
            <span className="text-muted-foreground">PHYSICAL SCAN</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold tracking-wider">
            <span>DETERMINISTIC</span>
          </div>
        </div>

        {/* Central Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
          {/* Battery Card */}
          <div className="surface-card rounded-xl p-4 border border-border/60 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Battery className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">Battery Curve</span>
              </div>
              <span className="text-xs font-mono text-amber-400 font-bold">78.2%</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>Cycle Count</span>
                <span className="text-foreground">412 / 500</span>
              </div>
              <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: "78.2%" }} />
              </div>
            </div>
          </div>

          {/* NVMe IOCTL Storage Card */}
          <div className="surface-card rounded-xl p-4 border border-border/60 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
                  <HardDrive className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">NVMe Log 0x02</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold">PASS</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>Media Errors</span>
                <span className="text-emerald-400 font-bold">0</span>
              </div>
              <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "91%" }} />
              </div>
            </div>
          </div>

          {/* Thermal Throttle Monitor */}
          <div className="surface-card rounded-xl p-4 border border-border/60 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">PROCHOT Thermal</span>
              </div>
              <span className="text-xs font-mono text-red-400 font-bold">94°C Peak</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>Throttle Events</span>
                <span className="text-red-400 font-bold">14 in 30m</span>
              </div>
              <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                <div className="h-full bg-red-400" style={{ width: "62%" }} />
              </div>
            </div>
          </div>

          {/* Overall Health Score Card */}
          <div className="surface-card rounded-xl p-4 border border-primary/30 bg-primary/5 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">Score Result</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-primary/20 text-primary font-bold">GRADE B</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-bold font-mono text-foreground">79</span>
                <span className="text-xs text-muted-foreground font-mono"> / 100</span>
              </div>
              <span className="text-[11px] font-mono text-amber-400">Action Recommended</span>
            </div>
          </div>
        </div>

        {/* Live Status Ticker */}
        <div className="rounded-lg bg-background/60 border border-border/40 p-3 flex items-center justify-between text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">WMI COM isolation active - zero apartment hang</span>
          </div>
          <span className="text-primary shrink-0 pl-3">READY</span>
        </div>
      </div>
    </div>
  );
}
