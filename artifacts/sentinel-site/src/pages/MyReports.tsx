import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Shield, ArrowRight, Mail, Check, Loader2, ExternalLink, LogOut } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

interface ReportSummary {
  id: string;
  createdAt: string;
  result: {
    overall: number;
    grade: string;
    gradeLabel: string;
    system: { model: string; hostname: string };
  };
  habitScore: number | null;
  combinedScore: number | null;
}

type PageState =
  | { mode: "loading" }
  | { mode: "auth"; devToken?: string }
  | { mode: "request-sent"; devToken?: string }
  | { mode: "reports"; email: string; reports: ReportSummary[] }
  | { mode: "error"; message: string };

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-400 bg-green-400/8 border-green-400/20" :
    score >= 60 ? "text-amber-400 bg-amber-400/8 border-amber-400/20" :
    "text-red-400 bg-red-400/8 border-red-400/20";
  return (
    <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded border ${color}`}>
      {score}
    </span>
  );
}

function RequestForm({ onSent }: { onSent: (devToken?: string) => void }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/my-reports/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const body = await res.json() as { ok: boolean; devToken?: string };
        onSent(body.devToken);
      } else {
        const body = await res.json() as { error?: string };
        setError(body.error ?? "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-md mx-auto">
      <AnimateIn>
        <div className="surface-card rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Access your reports</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Enter the email you used when saving a report. We'll send you a one-time sign-in link.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="you@example.com"
              disabled={submitting}
              className="flex-1 bg-background border border-border/60 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={submit}
              disabled={submitting || !email}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send link"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
        </div>
      </AnimateIn>
    </div>
  );
}

function LinkSentPanel({ devToken }: { devToken?: string }) {
  const [, navigate] = useLocation();

  return (
    <div className="max-w-md mx-auto">
      <AnimateIn>
        <div className="surface-card rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center mx-auto mb-5">
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">Check your inbox</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            We sent a sign-in link to your email. It expires in 15 minutes.
          </p>

          {/* Dev mode shortcut */}
          {devToken && (
            <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 p-4 text-left mb-4">
              <div className="text-xs font-mono text-amber-400/80 mb-2">Dev mode — click to sign in instantly:</div>
              <button
                onClick={() => navigate(`/api/my-reports/verify?token=${devToken}`)}
                className="text-xs font-mono text-foreground underline underline-offset-2 hover:text-primary transition-colors break-all"
              >
                /api/my-reports/verify?token={devToken}
              </button>
              <div className="mt-2">
                <a
                  href={`/api/my-reports/verify?token=${devToken}`}
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Open link <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </AnimateIn>
    </div>
  );
}

function ReportsList({ email, reports, onSignOut }: { email: string; reports: ReportSummary[]; onSignOut: () => void }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <AnimateIn>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Your reports</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/60 hover:border-border rounded-lg px-3 py-1.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </AnimateIn>

      {reports.length === 0 ? (
        <AnimateIn delay={0.05}>
          <div className="surface-card rounded-xl p-10 text-center">
            <Shield className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No reports saved to this account yet.</p>
            <Link href="/health-test" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
              Run your first health test <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </AnimateIn>
      ) : (
        <StaggerContainer className="space-y-3" staggerDelay={0.06}>
          {reports.map((r) => {
            const date = new Date(r.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            });
            const displayScore = r.combinedScore ?? r.result.overall;
            return (
              <StaggerItem key={r.id}>
                <Link href={`/r/${r.id}`}>
                  <div className="surface-card rounded-xl p-5 flex items-center gap-5 hover:border-primary/30 transition-all cursor-pointer">
                    <ScoreBadge score={displayScore} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{r.result.system.model}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.result.grade} · {r.result.gradeLabel}
                        {r.combinedScore !== null && (
                          <span className="ml-2 text-muted-foreground/50">· includes habit score</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground/60 font-mono shrink-0">{date}</div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}

      <div className="text-center">
        <AnimateIn delay={0.08}>
          <Link href="/health-test" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Run a new health test <ArrowRight className="w-4 h-4" />
          </Link>
        </AnimateIn>
      </div>
    </div>
  );
}

export default function MyReports() {
  const [location] = useLocation();
  const [state, setState] = useState<PageState>({ mode: "loading" });

  useEffect(() => {
    // Check if we're returning from a magic-link verify
    const verified = new URLSearchParams(window.location.search).get("verified") === "1";

    fetch("/api/my-reports")
      .then(async (res) => {
        if (res.ok) {
          const body = await res.json() as { email: string; reports: ReportSummary[] };
          setState({ mode: "reports", email: body.email, reports: body.reports });
          if (verified) {
            // Clean up the URL
            window.history.replaceState({}, "", window.location.pathname);
          }
        } else if (res.status === 401) {
          setState({ mode: "auth" });
        } else {
          setState({ mode: "error", message: "Something went wrong. Please try again." });
        }
      })
      .catch(() => setState({ mode: "error", message: "Network error. Please try again." }));
  }, [location]);

  const signOut = async () => {
    await fetch("/api/my-reports/session", { method: "DELETE" }).catch(() => {});
    setState({ mode: "auth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/60 bg-card/20 px-6 py-5">
        <AnimateIn>
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-base font-semibold">My Reports</h1>
          </div>
        </AnimateIn>
      </div>

      <div className="px-6 py-16">
        {state.mode === "loading" && (
          <AnimateIn>
            <div className="flex items-center justify-center">
              <div className="text-sm text-muted-foreground font-mono animate-pulse">Loading…</div>
            </div>
          </AnimateIn>
        )}

        {state.mode === "auth" && (
          <RequestForm onSent={(devToken) => setState({ mode: "request-sent", devToken })} />
        )}

        {state.mode === "request-sent" && (
          <LinkSentPanel devToken={state.devToken} />
        )}

        {state.mode === "reports" && (
          <ReportsList email={state.email} reports={state.reports} onSignOut={signOut} />
        )}

        {state.mode === "error" && (
          <AnimateIn>
            <div className="max-w-md mx-auto text-center">
              <p className="text-sm text-muted-foreground mb-4">{state.message}</p>
              <button
                onClick={() => setState({ mode: "loading" })}
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                Try again
              </button>
            </div>
          </AnimateIn>
        )}
      </div>
    </div>
  );
}
