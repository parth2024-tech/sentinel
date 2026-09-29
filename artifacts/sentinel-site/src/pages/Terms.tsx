import { Link } from "wouter";
import { FileText, AlertTriangle, ShieldCheck, Scale, ArrowLeft } from "lucide-react";
import AnimateIn from "@/components/AnimateIn";

export default function Terms() {
  return (
    <div className="min-h-screen py-24 px-6 max-w-4xl mx-auto">
      <AnimateIn>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">Terms of Service</span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Terms and Conditions</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-12">
          Last Updated: September 2026. By accessing Sentinel services or executing our collector software, you agree to these terms.
        </p>
      </AnimateIn>

      <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" /> 1. Scope of Service
          </h2>
          <p className="mb-3">
            Sentinel provides hardware diagnostic software, deterministic telemetry scoring algorithms, and fleet monitoring dashboards for Windows systems. The service is available via standalone scripts, native background agents, and web applications.
          </p>
          <p>
            Users are granted a non-exclusive, revocable license to run the software on personal or company-managed devices in accordance with their subscription tier.
          </p>
        </section>

        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> 2. Diagnostic Disclaimer & Limitation of Liability
          </h2>
          <p className="mb-3">
            Sentinel's scoring formulas and failure forecasting timelines are deterministic statistical estimates derived from system sensor readings (WMI, SMART, and ACPI interfaces).
          </p>
          <p className="mb-3">
            <strong className="text-foreground">Important:</strong> Diagnostic scores do not constitute a formal manufacturer warranty, legal guarantee, or insurance against sudden hardware failure. Sentinel is not liable for data loss, hardware breakdown, or repair costs resulting from unpredicted hardware failure or delayed maintenance.
          </p>
          <p>
            Always maintain off-site backups of critical files regardless of component health scores.
          </p>
        </section>

        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> 3. Acceptable Use Policy
          </h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2 mb-3">
            <li>Submit malicious, corrupted, or deliberately forged telemetry payloads designed to distort fleet analytics or abuse the API.</li>
            <li>Attempt to bypass API rate limits, authentication cookies, or device pairing authorization tokens.</li>
            <li>Redistribute proprietary enterprise MSI packages or agent binaries outside authorized tenant domains.</li>
          </ul>
        </section>

        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3">4. Enterprise Accounts & Subscriptions</h2>
          <p className="mb-3">
            Enterprise plans are billed per managed device per month. Device counts are audited based on active telemetry check-ins over a rolling 30-day window. You may cancel subscriptions at any time through the Billing Settings portal.
          </p>
        </section>
      </div>
    </div>
  );
}
