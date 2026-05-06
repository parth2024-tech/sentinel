import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowRight, Shield, AlertTriangle, Info,
  Share2, Check, Copy, Printer,
} from "lucide-react";
import { type ReportResult, type Prediction } from "@/lib/report/engine";
import AnimateIn from "@/components/AnimateIn";
import AdvancedDiagnostics from "@/components/AdvancedDiagnostics";

// ── Score ring (reused from Report) ──────────────────────────────────────────

const STATUS_STYLES = {
  healthy:   { bar: "bg-green-500",  badge: "text-green-400 border-green-400/20 bg-green-400/5"  },
  watch:     { bar: "bg-cyan-400",   badge: "text-cyan-400 border-cyan-400/20 bg-cyan-400/5"     },
  attention: { bar: "bg-amber-400",  badge: "text-amber-400 border-amber-400/20 bg-amber-400/5"  },
  critical:  { bar: "bg-red-400",    badge: "text-red-400 border-red-400/20 bg-red-400/5"        },
};

const URGENCY_STYLES = {
  critical: { border: "border-l-red-400",     badge: "text-red-400 bg-red-400/8 border-red-400/20"     },
  warning:  { border: "border-l-amber-400",   badge: "text-amber-400 bg-amber-400/8 border-amber-400/20" },
  info:     { border: "border-l-cyan-400/40", badge: "text-cyan-400 bg-cyan-400/8 border-cyan-400/20"   },
};

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#22d3ee" : score >= 60 ? "#f59e0b" : "#f87171";
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="rotate-[-90deg]">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-border/30" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }} />
    </svg>
  );
}

// ── Main shared report component ─────────────────────────────────────────────

export default function SharedReport() {
  const params = useParams<{ shareToken: string }>();
  const [result, setResult] = useState<ReportResult | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = params?.shareToken;
    if (!token) { setError("No share token provided."); return; }

    fetch(`/api/reports/shared/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json() as { result: ReportResult; createdAt: string };
          setResult(body.result);
          setCreatedAt(body.createdAt);

          // Set OG tags
          const title = `${body.result.system.model} — ${body.result.grade} (${body.result.overall}/100) · Sentinel`;
          document.title = title;
        } else if (res.status === 404) {
          setError("This shared report link is no longer valid or has been removed.");
        } else {
          setError("Unable to load this report.");
        }
      })
      .catch(() => setError("Network error. Please try again."));
  }, [params?.shareToken]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Report unavailable</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Link href="/health-test" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-background bg-primary hover:bg-primary/90 transition-all">
            Run your own scan <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading shared report…</p>
        </div>
      </div>
    );
  }

  const genDate = result.generatedAt
    ? new Date(result.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";

  const freeFindings = result.findings.filter((f) => !f.pro);
  const dqWarnings = result.dataQuality?.warnings ?? [];
  const structuredWarnings = typeof dqWarnings[0] === "object"
    ? (dqWarnings as unknown as Array<{ type: string; message: string; severity: string }>)
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground report-printable">

      {/* Shared badge */}
      <div className="bg-primary/5 border-b border-primary/10 px-6 py-3 print:bg-white print:border-b print:border-gray-300">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-primary/80">
            <Shield className="w-3.5 h-3.5" />
            <span className="font-medium">Read-only shared report</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/60">Generated {genDate}</span>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header: Score + System info */}
          <AnimateIn>
            <div className="surface-card rounded-xl p-6 print:shadow-none print:border print:border-gray-300">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="relative shrink-0 print:hidden">
                  <ScoreRing score={result.overall} />
                  <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">
                    {result.overall}
                  </span>
                </div>
                {/* Print-only score */}
                <div className="hidden print:block text-4xl font-bold text-gray-900 shrink-0">
                  {result.overall}/100
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">{result.system.model}</h1>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[result.grade as keyof typeof STATUS_STYLES]?.badge ?? STATUS_STYLES.watch.badge}`}>
                      {result.gradeLabel ?? result.grade}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.system.os ?? ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1.5">
                    Algorithm v{result.algoVersion} · {genDate}
                  </p>
                </div>
              </div>
            </div>
          </AnimateIn>

          {/* Data quality warnings */}
          {structuredWarnings.length > 0 && (
            <AnimateIn delay={0.02}>
              <div className="space-y-2">
                {structuredWarnings.map((w, i) => (
                  <div key={i} className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4 flex items-start gap-3 print:border print:border-amber-600 print:bg-amber-50">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 print:text-amber-600" />
                    <div>
                      <p className="text-xs font-mono text-amber-400/80 uppercase tracking-wide mb-0.5 print:text-amber-700">{w.type}</p>
                      <p className="text-sm text-muted-foreground/80 leading-relaxed print:text-gray-700">{w.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimateIn>
          )}

          {/* Component scores */}
          <AnimateIn delay={0.03}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {result.components.map((c) => {
                const sty = STATUS_STYLES[c.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.watch;
                return (
                  <div key={c.name} className="surface-card rounded-xl p-4 text-center print:border print:border-gray-200">
                    <div className="text-xs text-muted-foreground/60 mb-1 print:text-gray-500">{c.name}</div>
                    <div className="text-2xl font-bold text-foreground print:text-gray-900">{c.score}</div>
                    <div className={`w-full h-1.5 rounded-full bg-border/20 mt-2 overflow-hidden print:hidden`}>
                      <div className={`h-full rounded-full ${sty.bar} transition-all`} style={{ width: `${c.score}%` }} />
                    </div>
                    {c.detail && <div className="text-[10px] text-muted-foreground/40 mt-1.5 truncate print:text-gray-500">{c.detail}</div>}
                  </div>
                );
              })}
            </div>
          </AnimateIn>

          {/* Advanced System Diagnostics */}
          <AnimateIn delay={0.035}>
            <AdvancedDiagnostics report={result} />
          </AnimateIn>

          {/* Findings */}
          {freeFindings.length > 0 && (
            <AnimateIn delay={0.04}>
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 print:text-amber-600" />
                  Findings
                </h2>
                {freeFindings.map((f, i) => {
                  const us = URGENCY_STYLES[f.urgency as keyof typeof URGENCY_STYLES] ?? URGENCY_STYLES.info;
                  return (
                    <div key={i} className={`surface-card rounded-xl p-5 border-l-4 ${us.border} space-y-2 print:border print:border-gray-200 print:border-l-4`}>
                      <div className="flex items-start gap-3">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${us.badge} print:text-gray-700 print:border-gray-300 print:bg-gray-100`}>
                          {f.urgency}
                        </span>
                        <div>
                          <div className="text-xs font-mono text-muted-foreground/50 mb-0.5 print:text-gray-500">{f.component}</div>
                          <div className="text-sm font-semibold text-foreground print:text-gray-900">{f.title}</div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed print:text-gray-700">{f.body}</p>
                      {f.oemContext && (
                        <div className="mt-3 rounded-lg bg-primary/5 border border-primary/15 px-4 py-3 print:bg-blue-50 print:border-blue-200">
                          <p className="text-xs font-mono text-primary/60 uppercase tracking-wide mb-1.5 flex items-center gap-1.5 print:text-blue-700">
                            <Shield className="w-3 h-3" />
                            Why OEM tools miss this
                          </p>
                          <p className="text-xs text-muted-foreground/80 leading-relaxed print:text-gray-600">{f.oemContext}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </AnimateIn>
          )}

          {/* Predictions */}
          {result.predictions && result.predictions.length > 0 && (
            <AnimateIn delay={0.05}>
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400 print:text-cyan-600" />
                  Forward-looking insights
                </h2>
                {result.predictions.map((p: Prediction, i: number) => (
                  <div key={i} className="surface-card rounded-xl p-5 space-y-1 print:border print:border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground print:text-gray-900">{p.component}</div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        p.severity === 'urgent' ? 'text-red-400 border-red-400/20 bg-red-400/8'
                        : p.severity === 'declining' ? 'text-amber-400 border-amber-400/20 bg-amber-400/8'
                        : 'text-green-400 border-green-400/20 bg-green-400/8'
                      }`}>{p.severity}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed print:text-gray-700">{p.insight}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground/50 mt-1">
                      <span>Current: {p.currentValue}</span>
                      <span>·</span>
                      <span>Timeline: {p.projectedTimeline}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AnimateIn>
          )}

          {/* Footer */}
          <AnimateIn delay={0.06}>
            <div className="surface-card rounded-xl p-5 space-y-3 print:border print:border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="text-xs text-muted-foreground/60 leading-relaxed max-w-sm print:text-gray-500">
                  This is a read-only view of a Sentinel hardware health report. No personal information is included.
                </div>
                <Link
                  href="/health-test"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all print:hidden"
                >
                  Run your own scan <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="border-t border-border/30 pt-3 flex items-center justify-between flex-wrap gap-2 print:border-t print:border-gray-200">
                <span className="text-xs font-mono text-muted-foreground/40 print:text-gray-500">
                  Algorithm v{result.algoVersion} · {genDate} · Sentinel Hardware Health
                </span>
                <Link
                  href="/changelog"
                  className="text-xs text-primary/60 hover:text-primary transition-colors flex items-center gap-1 print:hidden"
                >
                  Scoring methodology & changelog <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </AnimateIn>

        </div>
      </div>
    </div>
  );
}
