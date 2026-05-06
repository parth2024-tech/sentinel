import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, ArrowLeft, Share2, RotateCcw, CheckCircle } from "lucide-react";
import AnimateIn, { StaggerContainer, StaggerItem } from "@/components/AnimateIn";
import { motion, animate } from "framer-motion";

/**
 * Interface representing a calibrated habit audit question.
 */
interface Question {
  /** Uniquely maps user answers to diagnostic scoring variables. */
  id: string;
  /** Primary question displayed on the screen. */
  text: string;
  /** Secondary contextual hint clarifying the degradation impact. */
  subtext?: string;
  /** Multi-choice options providing scoring deductions/penalties. */
  options: { label: string; detail?: string; penalty: number }[];
}

const QUESTIONS: Question[] = [
  {
    id: "charging",
    text: "How do you typically charge your laptop?",
    subtext: "Charging to 100% and staying there is the #1 battery killer.",
    options: [
      { label: "Always plugged in at 100%", detail: "Overnight, all day at desk", penalty: 3 },
      { label: "Plug in when low, charge to 100%", detail: "Standard charge cycle", penalty: 2 },
      { label: "I try to keep it between 20–80%", detail: "Smart charging", penalty: 0 },
      { label: "My laptop handles it automatically", detail: "Conservation mode enabled", penalty: 0 },
    ],
  },
  {
    id: "surface",
    text: "Where do you usually use your laptop?",
    subtext: "Soft surfaces block vents and raise temps by 8–15°C on average.",
    options: [
      { label: "Bed, couch, or pillow — always", penalty: 3 },
      { label: "Mostly soft surfaces, sometimes desk", penalty: 2 },
      { label: "Mix of desk and lap", penalty: 1 },
      { label: "Almost always on a hard, flat surface", penalty: 0 },
    ],
  },
  {
    id: "cleaning",
    text: "When did you last clean the vents or have the fans serviced?",
    subtext: "Dust accumulation reduces airflow by 30–50% within 18 months of daily use.",
    options: [
      { label: "Never", penalty: 3 },
      { label: "More than a year ago", penalty: 2 },
      { label: "6–12 months ago", penalty: 1 },
      { label: "Less than 6 months ago", penalty: 0 },
    ],
  },
  {
    id: "drain",
    text: "How often do you let the battery drain below 20%?",
    subtext: "Deep discharges stress lithium cells and accelerate capacity loss.",
    options: [
      { label: "Daily — I run it to empty regularly", penalty: 3 },
      { label: "A few times a week", penalty: 2 },
      { label: "Occasionally — maybe once a month", penalty: 1 },
      { label: "Rarely or never", penalty: 0 },
    ],
  },
  {
    id: "load",
    text: "Do you run demanding tasks (video, rendering, gaming) while plugged in?",
    subtext: "High load while charging creates peak heat stress on both battery and CPU.",
    options: [
      { label: "Yes, this is my main use case", penalty: 2 },
      { label: "Sometimes — for specific tasks", penalty: 1 },
      { label: "Rarely", penalty: 0 },
      { label: "Never — I use it lightly", penalty: 0 },
    ],
  },
  {
    id: "drops",
    text: "Has your laptop been dropped, knocked off a surface, or through airport security in the last year?",
    subtext: "Physical shock is the leading cause of SSD sector reallocation and hinge damage.",
    options: [
      { label: "Multiple times", penalty: 3 },
      { label: "Once or twice", penalty: 1 },
      { label: "Never — I'm careful", penalty: 0 },
    ],
  },
  {
    id: "restart",
    text: "How often do you fully restart your laptop?",
    subtext: "Sleep and hibernate don't clear memory leaks or apply driver updates.",
    options: [
      { label: "Rarely or never — I just close the lid", penalty: 2 },
      { label: "Monthly", penalty: 1 },
      { label: "Weekly", penalty: 0 },
      { label: "Daily or when prompted", penalty: 0 },
    ],
  },
  {
    id: "heat",
    text: "Does your laptop feel uncomfortably hot during normal use?",
    subtext: "Subjective heat is a reliable signal — human skin detects >40°C surface temp.",
    options: [
      { label: "Yes — it's hot to the touch regularly", penalty: 3 },
      { label: "Sometimes warm, rarely hot", penalty: 1 },
      { label: "Occasionally warm during heavy tasks", penalty: 1 },
      { label: "Rarely — it stays cool", penalty: 0 },
    ],
  },
];

const MAX_PENALTY = QUESTIONS.reduce((sum, q) => sum + Math.max(...q.options.map((o) => o.penalty)), 0);

/**
 * Resolves score grading buckets, contextual summary labels, and responsive layout colors.
 *
 * @param score Normalized score between 0 and 100.
 * @returns Grade parameters for UI reporting panels.
 */
function getGrade(score: number): { grade: string; label: string; color: string; detail: string } {
  if (score >= 85) return { grade: "A", label: "Excellent habits", color: "text-green-400", detail: "Your usage patterns are among the least damaging possible. Keep it up." };
  if (score >= 70) return { grade: "B", label: "Good habits", color: "text-cyan-400", detail: "A few habits are adding unnecessary stress. Small changes here will compound over years." };
  if (score >= 55) return { grade: "C", label: "Moderate wear", color: "text-amber-400", detail: "Several of your habits are silently shortening your laptop's life. Each issue below is actionable." };
  if (score >= 40) return { grade: "D", label: "High wear habits", color: "text-orange-400", detail: "Your usage pattern is accelerating hardware degradation significantly. Prioritise the findings below." };
  return { grade: "F", label: "Critical habits", color: "text-red-400", detail: "Your laptop is taking more daily damage than almost any other usage pattern. Start with charging and heat." };
}

/**
 * Maps question answers to highly descriptive advice items with categorized severity tags.
 * High urgency flags pinpoint critical degradation vectors (like heat & blocked vents).
 *
 * @param answers Key-value mapping of user selections.
 * @returns Array of formatted finding items for report visualization.
 */
function getFindingsForAnswers(answers: Record<string, number>): { title: string; advice: string; urgency: "high" | "medium" | "low" }[] {
  const findings: { title: string; advice: string; urgency: "high" | "medium" | "low" }[] = [];

  if (answers["charging"] >= 2) findings.push({ title: "Charging to 100% is degrading your battery", advice: "Keeping lithium batteries at 100% charge for extended periods causes electrolyte oxidation. Enable Windows Battery Saver at 80%, or use your OEM's conservation mode (Dell: 85%, Lenovo: 80%, HP: 80%). This alone can extend battery life by 1–2 years.", urgency: "high" });
  if (answers["surface"] >= 2) findings.push({ title: "Vent blockage from soft surfaces", advice: "Using the laptop on a bed or couch raises operating temperatures by 8–15°C by blocking the main exhaust vent. Over months, this accelerates thermal paste degradation and battery wear. A $10 laptop stand used consistently will lower your average CPU temp by 6–10°C.", urgency: answers["surface"] === 3 ? "high" : "medium" });
  if (answers["cleaning"] >= 2) findings.push({ title: "Dust buildup is compressing your thermals", advice: "Dust accumulation reduces airflow efficiency by 30–50% within 18 months of daily use. At 2+ years without cleaning, many laptops throttle 15–20% of their peak performance. Compressed air through the vents takes 5 minutes. A professional clean costs $20–40 and restores full airflow.", urgency: answers["cleaning"] === 3 ? "high" : "medium" });
  if (answers["drain"] >= 2) findings.push({ title: "Deep discharges are stressing your battery cells", advice: "Lithium batteries age faster at extreme state-of-charge levels. Letting the battery drain to 0% regularly removes approximately 3–5% of total capacity per 50 deep cycles compared to 20–80% cycling. Plug in before 20%.", urgency: "medium" });
  if (answers["load"] >= 1) findings.push({ title: "High load while charging creates dual heat stress", advice: "Running demanding workloads while charging generates maximum heat at the exact moment the battery is also under charge stress. Schedule rendering, exports, or gaming to off-peak periods, or ensure your cooling solution is working properly first.", urgency: "low" });
  if (answers["drops"] >= 1) findings.push({ title: "Physical shock history is a SMART risk factor", advice: "Even drops that don't visibly damage the laptop can cause SSD sector reallocation. Run a SMART check (CrystalDiskInfo, free) to confirm your drive shows 0 reallocated sectors. If it doesn't, back up now.", urgency: answers["drops"] === 3 ? "high" : "medium" });
  if (answers["restart"] >= 1) findings.push({ title: "Infrequent restarts accumulate memory and driver issues", advice: "Long sleep chains (days or weeks without a full restart) accumulate memory leaks, delay driver updates, and prevent Windows maintenance tasks from running. A weekly full restart takes 2 minutes and keeps memory fresh.", urgency: "low" });
  if (answers["heat"] >= 1) findings.push({ title: "Surface heat is a proxy for internal temperature", advice: "If the bottom of your laptop is uncomfortable to touch, the internal temperature near the battery is likely exceeding 45°C — a level associated with 2–4× faster capacity loss. Surface temperature above 40°C during light use is a ventilation problem.", urgency: answers["heat"] === 3 ? "high" : "medium" });

  return findings;
}

export default function HabitAudit() {
  const [step, setStep] = useState<"intro" | "quiz" | "results">("intro");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [, navigate] = useLocation();

  const totalPenalty = Object.values(answers).reduce((s, v) => s + v, 0);
  const score = Math.round(((MAX_PENALTY - totalPenalty) / MAX_PENALTY) * 100);

  useEffect(() => {
    if (step === "results") {
      const controls = animate(0, score, {
        duration: 0.8,
        ease: [0.25, 0.1, 0.25, 1],
        onUpdate: (val) => setDisplayedScore(Math.round(val))
      });
      return () => controls.stop();
    }
    return undefined;
  }, [step, score]);

  const question = QUESTIONS[current];

  function handleSelect(penalty: number) {
    setSelected(penalty);
  }

  function handleNext() {
    if (selected === null) return;
    const newAnswers = { ...answers, [question.id]: selected };
    setAnswers(newAnswers);
    setSelected(null);
    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      setStep("results");
    }
  }

  function handleBack() {
    if (current === 0) { setStep("intro"); return; }
    setCurrent(current - 1);
    setSelected(null);
  }

  function handleRestart() {
    setStep("intro");
    setCurrent(0);
    setAnswers({});
    setSelected(null);
  }

  const grade = getGrade(score);
  const findings = getFindingsForAnswers(answers);

  // Encode result in URL for sharing
  function getShareUrl() {
    const params = new URLSearchParams({ score: String(score), grade: grade.grade });
    return `${window.location.origin}/habit-audit?result=${btoa(params.toString())}`;
  }

  function handleShare() {
    navigator.clipboard.writeText(getShareUrl()).catch(() => {});
  }

  const urgencyOrder = { high: 0, medium: 1, low: 2 } as const;
  const sortedFindings = [...findings].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  if (step === "intro") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <section className="relative py-24 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/4 via-background to-primary/4 pointer-events-none" />
          <AnimateIn>
            <div className="relative max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent/5 text-accent text-xs font-mono mb-6">
                HABIT AUDIT
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
                What are your habits doing to your laptop?
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                8 questions. About 60 seconds. You'll get a personalised Habit Score and a specific list of what's silently wearing down your hardware.
              </p>
              <p className="text-sm text-muted-foreground/60 mb-10">No data leaves your browser. Results are generated locally.</p>
              <button
                onClick={() => setStep("quiz")}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all text-sm"
              >
                Start the audit <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </AnimateIn>
        </section>
      </div>
    );
  }

  if (step === "quiz") {
    const progress = ((current) / QUESTIONS.length) * 100;
    return (
      <div className="min-h-screen bg-background text-foreground">
        <section className="px-6 py-16">
          <div className="max-w-2xl mx-auto">
            {/* Progress */}
            <AnimateIn>
              <div className="mb-8">
                <div className="flex justify-between text-xs text-muted-foreground mb-2 font-mono">
                  <span>Question {current + 1} of {QUESTIONS.length}</span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <div className="h-1 bg-border/40 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </AnimateIn>

            {/* Question */}
            <AnimateIn>
              <div className="surface-card rounded-2xl p-8 mb-6">
                <h2 className="text-xl font-semibold tracking-tight mb-2 leading-snug">{question.text}</h2>
                {question.subtext && (
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{question.subtext}</p>
                )}
                <StaggerContainer className="space-y-3" staggerDelay={0.04}>
                  {question.options.map((opt) => (
                    <StaggerItem key={opt.label}>
                      <button
                        onClick={() => handleSelect(opt.penalty)}
                        className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                          selected === opt.penalty
                            ? "border-primary/60 bg-primary/8 text-foreground"
                            : "border-border/40 hover:border-border/80 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                            selected === opt.penalty ? "border-primary bg-primary shadow-[0_0_8px_var(--color-primary)]" : "border-border/60"
                          }`}>
                            {selected === opt.penalty && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{opt.label}</div>
                            {opt.detail && <div className="text-xs text-muted-foreground/60 mt-0.5">{opt.detail}</div>}
                          </div>
                        </div>
                      </button>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </div>
            </AnimateIn>

            {/* Nav */}
            <AnimateIn delay={0.05}>
              <div className="flex justify-between items-center">
                <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNext}
                  disabled={selected === null}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-background bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {current < QUESTIONS.length - 1 ? "Next" : "See my results"} <ArrowRight className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </AnimateIn>
          </div>
        </section>
      </div>
    );
  }

  // Results
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="px-6 py-16">
        <div className="max-w-2xl mx-auto">

          {/* Score card */}
          <AnimateIn>
            <div className="surface-card rounded-2xl p-8 mb-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />
              <div className="relative">
                <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mb-4">Your Habit Score</p>
                <div className={`text-7xl font-bold tracking-tight mb-2 ${grade.color}`}>{displayedScore}</div>
                <div className="text-muted-foreground text-sm mb-1">/ 100</div>
                <div className={`text-lg font-semibold mb-3 ${grade.color}`}>{grade.label}</div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">{grade.detail}</p>

                <div className="flex gap-3 justify-center mt-6">
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-all"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Copy share link
                  </button>
                  <button
                    onClick={handleRestart}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retake
                  </button>
                </div>
              </div>
            </div>
          </AnimateIn>

          {/* Findings */}
          {sortedFindings.length > 0 ? (
            <div className="space-y-4 mb-6">
              <AnimateIn>
                <h2 className="text-base font-semibold text-foreground">What's damaging your hardware</h2>
              </AnimateIn>
              <StaggerContainer className="space-y-3" staggerDelay={0.06}>
                {sortedFindings.map((f) => (
                  <StaggerItem key={f.title}>
                    <div
                      className={`surface-card rounded-xl p-5 border-l-2 ${
                        f.urgency === "high" ? "border-l-red-400" : f.urgency === "medium" ? "border-l-amber-400" : "border-l-cyan-400/50"
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className={`text-xs font-mono px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 mt-0.5 ${
                          f.urgency === "high" ? "bg-red-500/10 text-red-400" : f.urgency === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-cyan-500/10 text-cyan-400"
                        }`}>{f.urgency}</div>
                        <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.advice}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          ) : (
            <AnimateIn delay={0.05}>
              <div className="surface-card rounded-xl p-6 mb-6 flex items-center gap-4">
                <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-foreground mb-1">No major habit issues found</div>
                  <div className="text-sm text-muted-foreground">Your usage habits are among the best for long-term hardware health.</div>
                </div>
              </div>
            </AnimateIn>
          )}

          {/* CTA */}
          <AnimateIn delay={0.08}>
            <div className="surface-card rounded-xl p-6">
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                Habits explain <em>how</em> your laptop is wearing down. The diagnostic script shows <em>what's already happened</em>. Run both for the full picture.
              </p>
              <Link
                href="/health-test"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-background bg-primary hover:bg-primary/90 glow-cyan transition-all"
              >
                Run the hardware diagnostic <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </AnimateIn>

        </div>
      </section>
    </div>
  );
}
