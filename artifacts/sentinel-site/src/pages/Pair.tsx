import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, CheckCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import AnimateIn from "@/components/AnimateIn";

type PairStatus = "loading" | "ready" | "claiming" | "claimed" | "error";

export default function Pair() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [status, setStatus] = useState<PairStatus>("loading");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No pairing token found in URL. Please re-run the installer and try again.");
      return;
    }

    fetch(`/api/devices/pair-status?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setStatus(data.claimed ? "claimed" : "ready");
        } else {
          setStatus("error");
          setErrorMsg("This pairing token is invalid or has expired. Please re-run the installer.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Could not reach the Sentinel server. Please check your connection.");
      });
  }, [token]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setStatus("claiming");

    try {
      const res = await fetch("/api/devices/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairToken: token, email }),
      });

      if (res.ok) {
        setStatus("claimed");
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("ready");
        setErrorMsg(data.error ?? "Pairing failed. Please try again.");
      }
    } catch {
      setStatus("ready");
      setErrorMsg("Could not reach the server. Please check your connection.");
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md">

        {/* Logo / brand mark */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-cyan">
            <Shield className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Loading */}
        {status === "loading" && (
          <AnimateIn>
            <div className="surface-card rounded-2xl p-10 text-center border border-border/40">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Verifying your device…</h2>
              <p className="text-sm text-muted-foreground">Checking the pairing token from your installer.</p>
            </div>
          </AnimateIn>
        )}

        {/* Ready to claim */}
        {status === "ready" && (
          <AnimateIn>
            <div className="surface-card rounded-2xl p-10 border border-primary/30">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Pair your device</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter your email to link this machine to your Sentinel account. Your reports will be automatically associated with this address.
                </p>
              </div>

              <form onSubmit={handleClaim} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wide">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border/60 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
                    autoFocus
                  />
                  {emailError && (
                    <p className="text-xs text-red-400 mt-1.5">{emailError}</p>
                  )}
                </div>

                {errorMsg && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-background font-semibold hover:bg-primary/90 glow-cyan transition-all duration-200"
                >
                  Pair this device
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-5 leading-relaxed">
                Your email is only used to send you report-ready notifications. No password, no marketing.
              </p>
            </div>
          </AnimateIn>
        )}

        {/* Claiming in progress */}
        {status === "claiming" && (
          <AnimateIn>
            <div className="surface-card rounded-2xl p-10 text-center border border-border/40">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Pairing your device…</h2>
              <p className="text-sm text-muted-foreground">Linking this machine to your account.</p>
            </div>
          </AnimateIn>
        )}

        {/* Success */}
        {status === "claimed" && (
          <AnimateIn>
            <div className="surface-card rounded-2xl p-10 text-center border border-primary/40">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Device paired!</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                Sentinel will now automatically upload your hardware reports and send you an email when each one is ready. Your first report should appear shortly.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href="/my-reports"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-background font-semibold hover:bg-primary/90 glow-cyan transition-all"
                >
                  View my reports
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-card border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  Return home
                </a>
              </div>
            </div>
          </AnimateIn>
        )}

        {/* Error */}
        {status === "error" && (
          <AnimateIn>
            <div className="surface-card rounded-2xl p-10 text-center border border-red-500/20">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Pairing failed</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">{errorMsg}</p>
              <a
                href="/get-started"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-card border border-border/60 text-sm text-foreground hover:border-primary/30 transition-colors"
              >
                Back to Get Started
              </a>
            </div>
          </AnimateIn>
        )}
      </div>
    </div>
  );
}
