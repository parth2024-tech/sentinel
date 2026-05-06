import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronUp, Cpu, HardDrive, Monitor,
  RefreshCw, Terminal, Thermometer, Wifi, Shield, Activity
} from "lucide-react";

export default function AdvancedDiagnostics({ report }: { report: any }) {
  const [isOpen, setIsOpen] = useState(false);

  // Check if we have any advanced data
  const hasGpus = report.gpus && report.gpus.length > 0;
  const hasNetwork = report.network && (report.network.adapters?.length > 0 || report.network.connected !== undefined);
  const hasSecurity = report.security && (report.security.antivirusEnabled !== undefined || report.security.firewallProfilesActive);
  const hasProcesses = report.topProcesses && (report.topProcesses.cpuHogs?.length > 0 || report.topProcesses.ramHogs?.length > 0);
  const hasErrors = report.recentErrors && report.recentErrors.length > 0;
  const hasUpdates = report.updates && report.updates.hotFixId;
  const hasStartupList = report.startupList && report.startupList.length > 0;

  if (!hasGpus && !hasNetwork && !hasSecurity && !hasProcesses && !hasErrors && !hasUpdates && !hasStartupList) {
    return null;
  }

  return (
    <div className="surface-card rounded-2xl border border-border/40 overflow-hidden print:border print:border-gray-200">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-7 py-5 flex items-center justify-between text-left hover:bg-card/40 transition-colors print:pointer-events-none"
      >
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary animate-pulse print:text-gray-500 print:animate-none" />
          <div>
            <h2 className="text-sm font-mono text-muted-foreground/60 uppercase tracking-widest print:text-gray-700">Advanced System Diagnostics</h2>
            <p className="text-xs text-muted-foreground/40 mt-0.5 print:text-gray-500">Low-level OS health indicators, processes, updates, and errors</p>
          </div>
        </div>
        <div className="print:hidden">
          {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {(isOpen || (typeof window !== "undefined" && window.location.search.includes("print"))) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden print:!h-auto print:!opacity-100"
          >
            <div className="px-7 pb-7 pt-4 border-t border-border/20 space-y-6">
              {/* Grid 1: GPU, Network, Security, updates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* GPU Card */}
                {hasGpus && (
                  <div className="bg-background/40 border border-border/30 rounded-xl p-5 space-y-4 print:bg-white print:border print:border-gray-200">
                    <div className="flex items-center gap-2 text-primary print:text-gray-700">
                      <Monitor className="w-4 h-4" />
                      <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">GPU & Graphics</h3>
                    </div>
                    <div className="space-y-3">
                      {report.gpus.map((g: any, i: number) => (
                        <div key={i} className="border-b border-border/20 last:border-0 pb-3 last:pb-0">
                          <div className="text-sm font-semibold text-foreground print:text-gray-800">{g.name}</div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono">
                            <div>
                              <span className="text-muted-foreground/50 print:text-gray-400">VRAM:</span>{" "}
                              <span className="text-muted-foreground print:text-gray-600">{g.vramGb ? `${g.vramGb} GB` : "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/50 print:text-gray-400">Status:</span>{" "}
                              <span className={g.status === "OK" ? "text-green-400 print:text-green-600" : "text-red-400 print:text-red-600"}>{g.status ?? "Unknown"}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-muted-foreground/50 print:text-gray-400">Driver:</span>{" "}
                              <span className="text-muted-foreground text-[10px] print:text-gray-600">{g.driverVersion} ({g.driverDate?.split(" ")[0]})</span>
                            </div>
                            {g.tempC !== null && g.tempC !== undefined && (
                              <div className="col-span-2 flex items-center gap-1.5 mt-1">
                                <Thermometer className="w-3.5 h-3.5 text-orange-400 print:text-gray-500" />
                                <span className="text-muted-foreground/50 print:text-gray-400">GPU Temp:</span>{" "}
                                <span className={g.tempC > 80 ? "text-red-400 font-bold" : g.tempC > 70 ? "text-amber-400 font-bold" : "text-green-400"}>
                                  {g.tempC}°C
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Network Card */}
                {hasNetwork && (
                  <div className="bg-background/40 border border-border/30 rounded-xl p-5 space-y-4 print:bg-white print:border print:border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-accent print:text-gray-700">
                        <Wifi className="w-4 h-4" />
                        <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Network Connections</h3>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        report.network.connected 
                          ? "text-green-400 border-green-400/20 bg-green-400/5 print:text-green-700 print:bg-green-50"
                          : "text-red-400 border-red-400/20 bg-red-400/5 print:text-red-700 print:bg-red-50"
                      }`}>
                        {report.network.connected ? "Connected" : "No Internet"}
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[140px] overflow-y-auto custom-scrollbar print:max-h-none print:overflow-visible">
                      {report.network.adapters?.map((a: any, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-4 text-xs font-mono">
                          <div className="truncate">
                            <div className="font-semibold text-foreground text-xs truncate print:text-gray-800" title={a.name}>{a.name}</div>
                            <div className="text-[10px] text-muted-foreground/50 truncate print:text-gray-500" title={a.desc}>{a.desc}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-foreground print:text-gray-800">{a.ip ?? "No IP"}</div>
                            <div className="text-[10px] text-muted-foreground/50 print:text-gray-500">{a.speed ? `${a.speed} Mbps` : "N/A"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security Card */}
                {hasSecurity && (
                  <div className="bg-background/40 border border-border/30 rounded-xl p-5 space-y-4 print:bg-white print:border print:border-gray-200">
                    <div className="flex items-center gap-2 text-green-400 print:text-gray-700">
                      <Shield className="w-4 h-4" />
                      <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Security Status</h3>
                    </div>
                    <div className="space-y-2.5 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground/50 print:text-gray-400">Antivirus Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                          report.security.antivirusEnabled 
                            ? "text-green-400 border-green-400/20 bg-green-400/5 print:text-green-700"
                            : "text-red-400 border-red-400/20 bg-red-400/5 print:text-red-700"
                        }`}>
                          {report.security.antivirusEnabled ? "ACTIVE" : "DISABLED"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground/50 print:text-gray-400">Real-Time Protection</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                          report.security.realTimeProtection 
                            ? "text-green-400 border-green-400/20 bg-green-400/5 print:text-green-700"
                            : "text-red-400 border-red-400/20 bg-red-400/5 print:text-red-700"
                        }`}>
                          {report.security.realTimeProtection ? "ENABLED" : "DISABLED"}
                        </span>
                      </div>
                      {report.security.lastFullScan && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/50 print:text-gray-400">Last Full Scan</span>
                          <span className="text-muted-foreground text-right print:text-gray-700">
                            {new Date(report.security.lastFullScan).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}
                      {report.security.firewallProfilesActive && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/50 print:text-gray-400">Active Firewall</span>
                          <span className="text-muted-foreground truncate max-w-[180px] print:text-gray-700" title={report.security.firewallProfilesActive}>
                            {report.security.firewallProfilesActive}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Windows Update Card */}
                {hasUpdates && (
                  <div className="bg-background/40 border border-border/30 rounded-xl p-5 space-y-4 flex flex-col justify-between print:bg-white print:border print:border-gray-200">
                    <div>
                      <div className="flex items-center gap-2 text-cyan-400 print:text-gray-700 mb-3">
                        <RefreshCw className="w-4 h-4" />
                        <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">OS Update Status</h3>
                      </div>
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground/50 print:text-gray-400">Latest Update KB</span>
                          <span className="text-primary font-semibold print:text-gray-800">{report.updates.hotFixId}</span>
                        </div>
                        {report.updates.installedOn && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground/50 print:text-gray-400">Installed On</span>
                            <span className="text-muted-foreground print:text-gray-700">
                              {report.updates.installedOn.includes("/") 
                                ? report.updates.installedOn 
                                : new Date(report.updates.installedOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground/40 font-mono mt-4 print:text-gray-400">
                      Keep your OS updated to ensure compatibility with security patches.
                    </div>
                  </div>
                )}
              </div>

              {/* Processes section */}
              {hasProcesses && (
                <div className="bg-background/40 border border-border/30 rounded-xl p-5 space-y-4 print:bg-white print:border print:border-gray-200">
                  <div className="flex items-center gap-2 text-amber-400 print:text-gray-700">
                    <Cpu className="w-4 h-4" />
                    <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Top System Processes</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* CPU Hogs */}
                    <div>
                      <h4 className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-2 border-b border-border/10 pb-1 print:text-gray-500">Top 5 by CPU Usage</h4>
                      <div className="space-y-2">
                        {report.topProcesses.cpuHogs?.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs font-mono">
                            <span className="text-foreground font-semibold truncate max-w-[160px] print:text-gray-800" title={p.name}>{p.name}</span>
                            <span className="text-amber-400 print:text-amber-700">{p.cpuS}s <span className="text-muted-foreground/30">|</span> <span className="text-muted-foreground/60 text-[10px] print:text-gray-500">{p.ramMb} MB</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* RAM Hogs */}
                    <div>
                      <h4 className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-2 border-b border-border/10 pb-1 print:text-gray-500">Top 5 by RAM Allocation</h4>
                      <div className="space-y-2">
                        {report.topProcesses.ramHogs?.map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs font-mono">
                            <span className="text-foreground font-semibold truncate max-w-[160px] print:text-gray-800" title={p.name}>{p.name}</span>
                            <span className="text-primary print:text-blue-700">{p.ramMb} MB <span className="text-muted-foreground/30">|</span> <span className="text-muted-foreground/60 text-[10px] print:text-gray-500">{p.cpuS}s</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Startup List */}
              {report.startupList && report.startupList.length > 0 && (
                <div className="bg-background/40 border border-border/30 rounded-xl p-5 space-y-3 print:bg-white print:border print:border-gray-200">
                  <div className="flex items-center gap-2 text-muted-foreground print:text-gray-700">
                    <HardDrive className="w-4 h-4" />
                    <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Startup Items ({report.startupList.length})</h3>
                  </div>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar text-xs font-mono print:max-h-none print:overflow-visible">
                    {report.startupList.map((s: any, i: number) => (
                      <div key={i} className="flex flex-col border-b border-border/10 last:border-0 pb-1.5 last:pb-0">
                        <span className="text-foreground font-semibold truncate print:text-gray-800" title={s.name}>{s.name}</span>
                        <span className="text-[10px] text-muted-foreground/50 truncate mt-0.5 print:text-gray-500" title={s.command}>{s.command}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Event Log Console */}
              {hasErrors && (
                <div className="bg-background/40 border border-border/30 rounded-xl p-5 space-y-3 print:bg-white print:border print:border-gray-200">
                  <div className="flex items-center gap-2 text-red-400 print:text-gray-700">
                    <Terminal className="w-4 h-4" />
                    <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Recent System Errors (24h)</h3>
                  </div>
                  <div className="bg-black/40 border border-border/20 rounded-lg p-4 font-mono text-[10px] space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar print:bg-gray-50 print:border print:border-gray-200 print:max-h-none">
                    {report.recentErrors.map((e: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 border-b border-border/10 last:border-0 pb-2 last:pb-0">
                        <span className="text-muted-foreground/50 shrink-0 print:text-gray-400">
                          [{new Date(e.time).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}]
                        </span>
                        <span className="text-red-400 shrink-0 font-bold print:text-red-700">{e.source}:</span>
                        <span className="text-muted-foreground/80 break-all print:text-gray-700">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
