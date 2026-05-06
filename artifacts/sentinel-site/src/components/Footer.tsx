import { Link } from "wouter";
import { Shield } from "lucide-react";

const links = [
  { href: "/why", label: "Why Sentinel" },
  { href: "/oem-failures", label: "OEM Failures" },
  { href: "/compare", label: "Compare Tools" },
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/scoring", label: "How Scoring Works" },
  { href: "/what-it-monitors", label: "What It Monitors" },
  { href: "/risk-calculator", label: "Risk Calculator" },
  { href: "/habit-audit", label: "Habit Audit" },
  { href: "/get-started", label: "Get Started" },
  { href: "/health-test", label: "Health Test" },
  { href: "/sample-report", label: "Sample Report" },
  { href: "/faq", label: "FAQ" },
  { href: "/waitlist", label: "Join Waitlist" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <Shield className="w-6 h-6 text-primary" strokeWidth={1.5} />
              <span className="text-base font-semibold tracking-tight text-foreground">Sentinel</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Transparent hardware diagnostics for Windows laptops. Know what's wearing out and why.
            </p>
          </div>

          {/* Nav */}
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Sentinel. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse inline-block" />
            All diagnostics run locally. Zero data sent to the cloud.
          </span>
        </div>
      </div>
    </footer>
  );
}
