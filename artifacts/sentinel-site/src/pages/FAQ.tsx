import { useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ArrowRight } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";

const faqs = [
  {
    question: "Is my data private?",
    answer: "Completely. Sentinel runs entirely on your machine. No data is sent to any external server — not diagnostic readings, not usage patterns, not your hardware specs. Everything stays local. We have no servers receiving your data because we built it that way intentionally.",
  },
  {
    question: "How much CPU does it use?",
    answer: "Less than 1% on average. Sentinel is designed to be invisible — it uses idle CPU cycles for analysis and pauses during intensive workloads. You won't notice it running unless you go looking for it in Task Manager.",
  },
  {
    question: "What Windows versions are supported?",
    answer: "Windows 10 (version 2004 and later) and Windows 11. Both 64-bit editions. ARM64 support is planned for a future release.",
  },
  {
    question: "Why predictive instead of reactive?",
    answer: "Reactive tools tell you something broke. That's already too late — you've lost data, missed a deadline, or paid for an emergency repair. Predictive monitoring gives you weeks of lead time to back up, schedule service, or order a replacement before anything actually fails.",
  },
  {
    question: "How does Sentinel learn my machine?",
    answer: "In the first 3–5 days after installation, Sentinel collects baseline readings across all monitored subsystems under your normal usage conditions. It builds a statistical model of your laptop's healthy behavior — unique to your machine, your workloads, and your environment. After that, deviations from that baseline trigger analysis.",
  },
  {
    question: "Is there a free tier?",
    answer: "The early access release will be free. Long-term pricing hasn't been finalized, but we're committed to keeping core features accessible. Join the waitlist and you'll be notified before anything changes.",
  },
  {
    question: "Can I control what it monitors?",
    answer: "Yes. Every subsystem can be individually enabled or disabled from the settings panel. If you only want battery and SSD tracking, you can run exactly that. Sentinel doesn't impose monitoring you don't want.",
  },
  {
    question: "How are weekly reports delivered?",
    answer: "Weekly reports appear as a local notification on your machine. You can view the full report in Sentinel's interface. No email is required, and reports are never sent to external servers.",
  },
];

function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="border border-border/60 rounded-xl overflow-hidden transition-colors hover:border-border"
      data-testid={`faq-item-${index}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-muted/20 transition-colors"
        data-testid={`faq-toggle-${index}`}
      >
        <span className="font-medium text-foreground">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-5">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="px-6 py-20">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <AnimateIn>
          <div className="mb-16">
            <div className="mb-4">
              <span className="text-xs font-mono font-medium px-3 py-1 rounded-full border border-primary/30 text-primary bg-primary/10">
                FAQ
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6" data-testid="heading-faq">
              Questions,{" "}
              <span className="gradient-text">answered directly.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We built Sentinel to be transparent. If something isn't covered here, reach out.
            </p>
          </div>
        </AnimateIn>

        {/* FAQ items — staggered */}
        <StaggerContainer className="flex flex-col gap-3" staggerDelay={0.06}>
          {faqs.map((faq, i) => (
            <StaggerItem key={i}>
              <FAQItem question={faq.question} answer={faq.answer} index={i} />
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bottom CTA */}
        <AnimateIn delay={0.1}>
          <div className="mt-16 text-center flex flex-col items-center gap-5">
            <p className="text-muted-foreground text-sm">Ready to give Sentinel a try?</p>
            <Link
              href="/waitlist"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all duration-200"
              data-testid="button-faq-waitlist"
            >
              Join the waitlist
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </AnimateIn>
      </div>
    </div>
  );
}
