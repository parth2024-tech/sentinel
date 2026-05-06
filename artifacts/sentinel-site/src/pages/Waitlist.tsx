import { Shield, Lock, Cpu, Battery } from "lucide-react";
import WaitlistForm, { WaitlistCount } from "@/components/WaitlistForm";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const reassurances = [
  {
    icon: Lock,
    label: "No spam, ever",
    description: "One email when early access opens. That's it.",
  },
  {
    icon: Cpu,
    label: "Runs completely local",
    description: "All diagnostics happen on your machine.",
  },
  {
    icon: Battery,
    label: "Under 1% CPU",
    description: "Silent and invisible until you need it.",
  },
];

export default function Waitlist() {
  return (
    <div className="px-6 py-20 min-h-[80vh] flex items-center">
      <div className="max-w-2xl mx-auto w-full">
        <AnimateIn delay={0.1} direction="up">
          {/* Visual icon */}
          <div className="flex justify-center mb-12">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center glow-cyan">
                <Shield className="w-9 h-9 text-primary" strokeWidth={1.5} />
              </div>
              {/* Rings */}
              <div className="absolute inset-0 rounded-full border border-primary/10 animate-pulse-ring" />
              <div className="absolute inset-0 rounded-full border border-primary/10 animate-pulse-ring" style={{ animationDelay: "0.8s" }} />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10 mb-5 inline-block">
              EARLY ACCESS
            </span>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-5" data-testid="heading-waitlist">
              Be the first to know{" "}
              <span className="gradient-text">when Sentinel launches.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto">
              Sentinel is in active development. Join the waitlist and get notified the moment early access is available.
            </p>
          </div>
        </AnimateIn>

        {/* Form */}
        <AnimateIn delay={0.2} direction="up">
          <div className="surface-card rounded-2xl p-8 mb-8" data-testid="section-waitlist-form">
            <WaitlistForm />
            <div className="mt-4 flex justify-center">
              <WaitlistCount />
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">
              One launch email. No newsletters. Unsubscribe any time.
            </p>
          </div>
        </AnimateIn>

        {/* Reassurances */}
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4" staggerDelay={0.1}>
          {reassurances.map((r) => (
            <StaggerItem key={r.label}>
              <div
                className="flex flex-col items-center text-center gap-2 p-4 rounded-xl border border-border/40 bg-card/40 h-full"
                data-testid={`card-reassurance-${r.label.replace(/\s/g, "-").toLowerCase()}`}
              >
                <r.icon className="w-5 h-5 text-primary" />
                <p className="text-sm font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  );
}
