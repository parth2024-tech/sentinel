import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Shield } from "lucide-react";

const navLinks = [
  { href: "/why", label: "Why Sentinel" },
  { href: "/scoring", label: "How Scoring Works" },
  { href: "/risk-calculator", label: "Risk Calculator" },
  { href: "/health-test", label: "Health Test" },
  { href: "/live", label: "Live", pulse: true },
  { href: "/troubleshoot", label: "Troubleshoot" },
];


export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative">
            <Shield
              className="w-7 h-7 text-primary transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
              strokeWidth={1.5}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-primary animate-glow-pulse" />
            </div>
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
            Sentinel
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1.5 ${
                location === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
              {link.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/get-started"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-background hover:bg-primary/90 transition-all duration-200 glow-cyan"
            data-testid="button-get-started-header"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1.5 ${
                location === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
              {link.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
              )}
            </Link>
          ))}
          <Link
            href="/waitlist"
            onClick={() => setMobileOpen(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-center transition-all"
            data-testid="button-join-waitlist-mobile"
          >
            Join Waitlist
          </Link>
        </div>
      )}
    </header>
  );
}
