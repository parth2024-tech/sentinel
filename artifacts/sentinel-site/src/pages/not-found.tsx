import { Link } from "wouter";
import { Shield, ArrowLeft, AlertTriangle } from "lucide-react";
import AnimateIn from "@/components/AnimateIn";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <AnimateIn>
        <div className="relative text-center max-w-md mx-auto flex flex-col items-center gap-8">
          {/* Icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center glow-cyan">
              <Shield className="w-9 h-9 text-primary" strokeWidth={1.5} />
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-full border border-primary/10 animate-pulse-ring" />
            <div className="absolute inset-0 rounded-full border border-primary/10 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
          </div>

          {/* Error code */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono text-primary/60 uppercase tracking-widest">
              SENTINEL — ERROR 404
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Page not found.
            </h1>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Sentinel couldn't locate the page you're looking for. It may have moved, or the URL might be incorrect.
            </p>
          </div>

          {/* Warning chip */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 font-mono text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Route not matched — returning to known state</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
            <Link
              href="/waitlist"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm border border-border/60 text-foreground hover:border-primary/60 hover:text-primary transition-all duration-200"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </AnimateIn>
    </div>
  );
}
