import { Link } from "wouter";
import { Shield, Lock, HardDrive, EyeOff, Server, ArrowLeft } from "lucide-react";
import AnimateIn from "@/components/AnimateIn";

export default function Privacy() {
  return (
    <div className="min-h-screen py-24 px-6 max-w-4xl mx-auto">
      <AnimateIn>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-primary font-semibold">Legal & Transparency</span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-12">
          Effective Date: September 2026. This policy governs how Sentinel collects, inspects, and stores hardware diagnostic telemetry.
        </p>
      </AnimateIn>

      <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-primary" /> 1. Core Data Philosophy
          </h2>
          <p className="mb-3">
            Sentinel is an engineering diagnostic platform, not a marketing analytics tracker. We do not sell personal data, display advertising, track cross-site activity, or scrape personal documents.
          </p>
          <p>
            Hardware queries execute strictly within your local Windows environment using read-only APIs (WMI, Windows Performance Counters, and direct low-level storage IOCTL queries).
          </p>
        </section>

        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" /> 2. Telemetry Collected
          </h2>
          <p className="mb-4">
            When you run a diagnostic scan or deploy the SentinelAgent service, the following technical data points are gathered:
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li><strong className="text-foreground">System Specifications:</strong> Motherboard manufacturer, laptop model, BIOS revision, Windows operating system build, and CPU core architecture.</li>
            <li><strong className="text-foreground">Battery Health:</strong> Design capacity, full charge capacity, cycle count, discharge rate, voltage, and internal thermal sensor reading.</li>
            <li><strong className="text-foreground">Thermals & Throttling:</strong> ACPI thermal zone temperatures, CPU core temperature deltas, and kernel PROCHOT thermal throttle event counts.</li>
            <li><strong className="text-foreground">Storage Diagnostics:</strong> NVMe SMART Health Log (Log Page 0x02), percentage used, available spare threshold, media errors, reallocated sectors, and total power-on hours.</li>
            <li><strong className="text-foreground">Memory & Performance:</strong> RAM utilization percentage, page fault rates, DPC latency percentage, and counts of active OEM vendor background services.</li>
          </ul>
          <p className="text-xs text-muted-foreground/80 bg-background/50 p-3 rounded-lg border border-border/40">
            <strong>What we never collect:</strong> Personal files, file paths, keystrokes, network browsing history, IP traffic content, stored passwords, or user identity records.
          </p>
        </section>

        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" /> 3. Local vs. Cloud Ingestion
          </h2>
          <p className="mb-3">
            <strong className="text-foreground">Local Execution:</strong> Offline scans and diagnostic queries evaluate scores entirely on the client machine.
          </p>
          <p className="mb-3">
            <strong className="text-foreground">Saved & Shared Reports:</strong> When you run the PowerShell script with direct upload, pair a background agent, or explicitly save a report, your diagnostic JSON is transmitted over TLS 1.3 to our API server for cryptographic verification, trend projection calculation, and report storage.
          </p>
          <p>
            <strong className="text-foreground">IP Anonymization:</strong> Client IP addresses are immediately run through a one-way cryptographic HMAC hash for rate-limiting and abuse prevention. Raw IP addresses are never persisted in the database.
          </p>
        </section>

        <section className="surface-card rounded-xl p-8 border border-border/60">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> 4. Data Retention and Deletion
          </h2>
          <p className="mb-3">
            Unclaimed public diagnostic reports expire automatically after 30 days. Reports linked to an authenticated account or organization workspace remain accessible until deleted by the user or enterprise administrator.
          </p>
          <p>
            Under GDPR and CCPA, you have the right to request permanent deletion of any diagnostic report associated with your email address or device claim token by contacting privacy@sentinelapp.io.
          </p>
        </section>
      </div>
    </div>
  );
}
