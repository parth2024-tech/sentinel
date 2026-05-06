import { Link } from "wouter";
import { Terminal, Copy, CheckCheck, Activity, ShieldCheck, Zap, Download } from "lucide-react";
import AnimateIn from "@/components/AnimateIn";
import DownloadButton from "@/components/DownloadButton";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function HealthTest() {
  const [copied, setCopied] = useState(false);

  const scriptCommand = `Set-ExecutionPolicy Bypass -Scope Process -Force; irm ${typeof window !== 'undefined' ? window.location.origin : 'https://sentinelapp.io'}/scripts/sentinel-collect.ps1 -OutFile $env:TEMP\\s.ps1; & $env:TEMP\\s.ps1 -DirectUpload`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        </div>
        <AnimateIn>
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-medium mb-6">
              <Activity className="w-3.5 h-3.5" />
              Frictionless Diagnostic
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Laptop Health Test
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Run a comprehensive hardware diagnostic on your Windows laptop. 
              Data is securely uploaded, and your report opens instantly.
            </p>
          </div>
        </AnimateIn>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* The Script */}
          <AnimateIn delay={0.1}>
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <div className="p-8">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl bg-card border border-border/60 flex items-center justify-center shrink-0">
                    <Terminal className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 w-full min-w-0">
                    <h2 className="text-xl font-bold text-foreground mb-2">Run the Diagnostic Script</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                      Open PowerShell as Administrator and run the open-source script.
                    </p>
                    
                    <div className="rounded-xl bg-[#0d1117] border border-border/40 px-5 py-4 w-full">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="text-xs text-muted-foreground/60 uppercase tracking-wide font-mono">Run in PowerShell</div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handleCopy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
                        >
                          <AnimatePresence mode="wait">
                            {copied ? (
                              <motion.div
                                key="copied"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-1.5"
                              >
                                <CheckCheck className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-green-400">Copied!</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="copy"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-1.5"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>
                      <div className="font-mono text-sm text-slate-300 break-all bg-black/40 p-4 rounded-lg border border-border/30 overflow-x-auto whitespace-pre-wrap">
                        <span className="text-cyan-400">Set-ExecutionPolicy Bypass -Scope Process -Force; irm {typeof window !== 'undefined' ? window.location.origin : 'https://sentinelapp.io'}/scripts/sentinel-collect.ps1 -OutFile $env:TEMP\s.ps1; & $env:TEMP\s.ps1</span> <span className="text-amber-400">-DirectUpload</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                      <a
                        href={`${import.meta.env.BASE_URL}scripts/sentinel-collect.ps1`}
                        download="sentinel-collect.ps1"
                        className="inline-flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors font-medium"
                      >
                        <Download className="w-3 h-3" /> Or download script manually
                      </a>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </AnimateIn>

          <AnimateIn delay={0.15}>
            <p className="text-xs text-muted-foreground/50 text-center flex items-center justify-center gap-1.5">
              <Zap className="w-3 h-3" />
              Both options automatically sync to your browser upon completion.
            </p>
          </AnimateIn>

          <AnimateIn delay={0.2}>
            <div className="flex flex-col items-center justify-center gap-3 mt-8 p-6 rounded-2xl border border-border/60 bg-card/40">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium text-foreground">Waiting for device telemetry...</span>
              </div>
              <p className="text-xs text-muted-foreground">Run the app or script to see your report instantly.</p>
            </div>
          </AnimateIn>

        </div>
      </section>
    </div>
  );
}
