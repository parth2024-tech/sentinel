import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Cpu, Battery, HardDrive, Thermometer, Sparkles, RotateCcw, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { useSearch } from "wouter";
import AnimateIn from "@/components/AnimateIn";
import { motion, AnimatePresence } from "framer-motion";

// ── Knowledge Base ──────────────────────────────────────────────────────────

interface Step {
  type: "action" | "decision";
  text: string;
  code?: string;
}

interface Solution {
  title: string;
  steps: Step[];
  urgency: "low" | "medium" | "high";
  component: string;
}

interface KBEntry {
  topic: string; // Used for direct routing from Report.tsx
  keywords: string[];
  solution: Solution;
}

const KB: KBEntry[] = [
  {
    topic: "battery",
    keywords: ["battery", "drain", "wear", "capacity", "cycle", "cycles", "charge"],
    solution: {
      title: "Battery degradation or unexpected drain",
      component: "Battery",
      urgency: "medium",
      steps: [
        {
          type: "action",
          text: "First, generate a deep battery diagnostic report natively in Windows to verify the raw sensor data.",
          code: "powercfg /batteryreport /output \"C:\\battery-report.html\"",
        },
        {
          type: "action",
          text: "Open the generated report by navigating to **C:\\battery-report.html** in your browser. Compare 'Design Capacity' against 'Full Charge Capacity'.",
        },
        {
          type: "action",
          text: "If the capacity gap is primarily due to software drain, check which apps are consuming power by navigating to **Settings → System → Power & battery → Battery usage**.",
        },
        {
          type: "decision",
          text: "Is the Full Charge Capacity less than 60% of Design Capacity? If yes, software fixes won't help — physical replacement is required. If no, ensure 'Battery Saver' is engaging at 20% to prevent deep discharges.",
        },
      ],
    },
  },
  {
    topic: "thermal",
    keywords: ["overheat", "hot", "heat", "thermal", "temperature", "fan", "loud", "throttle", "throttling"],
    solution: {
      title: "Elevated thermals & processor throttling",
      component: "Thermals",
      urgency: "high",
      steps: [
        {
          type: "action",
          text: "Thermal throttling occurs when the CPU hits its TjMax (usually 95-100°C). First, check if a rogue background process is keeping the CPU pegged at 100%. Open **Task Manager (Ctrl+Shift+Esc) → Details tab** and sort by CPU.",
        },
        {
          type: "action",
          text: "Ensure Windows cooling policy is set to active (increases fan speed before slowing CPU):",
          code: "powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCSYSMAXPOL 100",
        },
        {
          type: "action",
          text: "Physically inspect the bottom and side intake vents. If you use the laptop on a bed or soft surface, intake is blocked. Elevate the rear of the laptop by 1 inch.",
        },
        {
          type: "decision",
          text: "Do the fans sound like they are spinning up? If the laptop is hot but silent, the fan connector may be loose or the fan motor is dead. If the fans are loud but the laptop is still throttling, you need to clean the heat sink fins with compressed air.",
        },
      ],
    },
  },
  {
    topic: "storage",
    keywords: ["storage", "wear", "nvme", "health", "ssd", "reallocated", "failing", "drive", "smart", "space"],
    solution: {
      title: "Storage degradation or critical wear level",
      component: "Storage",
      urgency: "high",
      steps: [
        {
          type: "action",
          text: "IMMEDIATE ACTION: A degraded SSD can fail without further warning. Back up your critical files to OneDrive, Google Drive, or an external disk right now.",
        },
        {
          type: "action",
          text: "Check if Windows recognizes NTFS file system errors using the built-in repair tool. Open an Administrator PowerShell and run:",
          code: "chkdsk C: /f /r /x",
        },
        {
          type: "action",
          text: "Check exactly how much free space remains. Navigate to **Settings → System → Storage**. SSDs use 'wear leveling' to spread writes across empty blocks. You must keep at least 15% of your drive completely empty to prevent accelerated wear.",
        },
        {
          type: "decision",
          text: "Are you seeing 'Reallocated Sectors' in your report? If yes, the drive is actively finding dead flash memory cells and mapping around them. The drive is dying and must be replaced. If wear level is just high (e.g. 80% used), the drive is healthy but old.",
        },
      ],
    },
  },
  {
    topic: "cpu",
    keywords: ["cpu", "slow", "load", "lag", "sluggish", "freeze", "freezing", "hang", "bsod", "crash"],
    solution: {
      title: "High CPU load or system instability",
      component: "CPU",
      urgency: "medium",
      steps: [
        {
          type: "action",
          text: "If your CPU is constantly under load, check for corrupted Windows system files which often cause the 'System' process to spike. Open an Administrator PowerShell and run:",
          code: "sfc /scannow",
        },
        {
          type: "action",
          text: "If SFC finds unrepairable files, restore the Windows image using DISM:",
          code: "DISM /Online /Cleanup-Image /RestoreHealth",
        },
        {
          type: "action",
          text: "Check if the crashes/sluggishness are caused by a fast-startup hibernation issue. Disable Fast Startup by navigating to **Control Panel → Power Options → Choose what the power buttons do → uncheck Turn on fast startup**.",
        },
        {
          type: "decision",
          text: "Did the SFC scan find and fix integrity violations? If yes, restart your machine and observe if the sluggishness is resolved. If no, your instability may be hardware-induced (check thermals).",
        },
      ],
    },
  },
  {
    topic: "memory",
    keywords: ["ram", "memory", "usage", "leak", "high memory", "out of memory", "page", "faults"],
    solution: {
      title: "Memory pressure and page faults",
      component: "Memory",
      urgency: "medium",
      steps: [
        {
          type: "action",
          text: "When physical RAM is full, Windows relies on the page file (using the SSD as slow RAM). High page faults per second indicates severe memory starvation. First, check your startup apps by navigating to **Settings → Apps → Startup** and disabling everything non-essential.",
        },
        {
          type: "action",
          text: "Verify that Windows is managing your page file correctly. Do not manually restrict its size. Open PowerShell and check the current page file usage:",
          code: "Get-WmiObject Win32_PageFileUsage | Select-Object Name, AllocatedBaseSize",
        },
        {
          type: "action",
          text: "If you suspect a memory leak (RAM fills up over days of uptime), restart your computer at least once a week.",
        },
        {
          type: "decision",
          text: "Is your baseline memory usage above 85% even with only 2-3 browser tabs open? If yes, your workload exceeds your hardware capacity — an immediate RAM upgrade is the only permanent fix.",
        },
      ],
    },
  }
];

// ── UI Components ───────────────────────────────────────────────────────────

function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative mt-2 mb-3 bg-[#0a0e1a] border border-primary/20 rounded-lg overflow-hidden group">
      <div className="flex items-center justify-between px-3 py-1.5 bg-primary/10 border-b border-primary/20">
        <span className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">PowerShell / Command Prompt</span>
        <button 
          onClick={handleCopy}
          className="text-primary/60 hover:text-primary transition-colors flex items-center gap-1 text-[10px] font-mono uppercase min-w-[60px] justify-end"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div key="copied" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-1 text-green-400">
                <Check className="w-3 h-3" /> Copied
              </motion.div>
            ) : (
              <motion.div key="copy" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
      <div className="p-3 text-xs font-mono text-cyan-400 overflow-x-auto whitespace-pre">
        {code}
      </div>
    </div>
  );
}

function renderTextWithBoldPaths(text: string) {
  // Bold text surrounded by ** **
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold px-1.5 py-0.5 rounded bg-muted/20 mx-0.5">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function FeedbackWidget({ messageId }: { messageId: number }) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  if (feedback) {
    return (
      <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium w-fit">
        <Check className="w-3.5 h-3.5" />
        Thanks for the feedback. This helps improve the knowledge base.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40">
      <span className="text-xs text-muted-foreground">Did this resolve your issue?</span>
      <div className="flex items-center gap-2">
        <motion.button 
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10, duration: 0.15 }}
          onClick={() => setFeedback("up")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-card border border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors text-xs text-muted-foreground"
        >
          <ThumbsUp className="w-3 h-3" /> Yes
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 10, duration: 0.15 }}
          onClick={() => setFeedback("down")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-card border border-border/60 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/40 transition-colors text-xs text-muted-foreground"
        >
          <ThumbsDown className="w-3 h-3" /> No
        </motion.button>
      </div>
    </div>
  );
}

// ── Message types ───────────────────────────────────────────────────────────

interface Message {
  id: number;
  role: "user" | "assistant";
  text?: string;
  solutions?: Solution[];
}

const URGENCY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-cyan-500/10 border-cyan-500/30", text: "text-cyan-400", label: "Low Urgency" },
  medium: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", label: "Medium Urgency" },
  high: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "High Urgency" },
};

// ── Main Page ───────────────────────────────────────────────────────────────

export default function Troubleshoot() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const topicParam = searchParams.get("topic");
  const titleParam = searchParams.get("title");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgId = useRef(0);

  const [isPreloading, setIsPreloading] = useState(!!topicParam);

  // Pre-load context if arriving from a report finding
  useEffect(() => {
    if (topicParam && messages.length === 0) {
      setTimeout(() => {
        const entry = KB.find(k => k.topic === topicParam);
        if (entry) {
          setMessages([
            {
              id: ++msgId.current,
              role: "assistant",
              text: `You arrived here because your report flagged an issue: **${titleParam || entry.solution.title}**. Here are the relevant diagnostic steps.`,
              solutions: [entry.solution]
            }
          ]);
        }
        setIsPreloading(false);
      }, 1000);
    }
  }, [topicParam, titleParam]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  function findSolutions(query: string): Solution[] {
    const lower = query.toLowerCase();
    const words = lower.split(/\\s+/);

    const scored = KB.map((entry) => {
      let score = 0;
      if (lower.includes(entry.topic)) score += 5;
      for (const kw of entry.keywords) {
        if (lower.includes(kw)) score += 3;
        for (const w of words) {
          if (w.length > 2 && kw.startsWith(w)) score += 1;
        }
      }
      return { solution: entry.solution, score };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, 2).map((s) => s.solution);
  }

  function handleSubmit(query: string) {
    if (!query.trim()) return;
    const userMsg: Message = { id: ++msgId.current, role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const solutions = findSolutions(query);
      const assistantMsg: Message = {
        id: ++msgId.current,
        role: "assistant",
        text: solutions.length === 0
          ? "I couldn't find a specific match for that issue in our diagnostic knowledge base. Try describing the problem using core component names (battery, thermals, storage, cpu, memory)."
          : undefined,
        solutions: solutions.length > 0 ? solutions : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 600);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-16 px-6 border-b border-border/60 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/4 via-background to-accent/4 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/3 blur-[120px] pointer-events-none" />
        <AnimateIn>
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              INTELLIGENT TROUBLESHOOTER
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Diagnostic steps mapped to{" "}
              <span className="gradient-text">exact failure modes.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Clear pass/fail decision points, copyable CLI commands, and exact Windows navigation paths. No more digging through forums.
            </p>
          </div>
        </AnimateIn>
      </section>

      {/* Chat area */}
      <section className="px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <AnimateIn delay={0.05}>
            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden shadow-xl flex flex-col" style={{ height: "min(75vh, 700px)" }}>
 
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
                
                {isPreloading && (
                  <div className="max-w-2xl animate-skeleton-pulse space-y-4">
                    <div className="h-12 w-3/4 bg-muted/20 rounded-xl" />
                    <div className="h-32 w-full bg-muted/20 rounded-2xl" />
                  </div>
                )}

                {messages.length === 0 && !isPreloading && (
                  <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-cyan">
                      <MessageCircle className="w-7 h-7 text-primary" />
                    </div>
                    <div className="text-center max-w-md">
                      <p className="text-sm font-medium text-foreground mb-2">What issue are you troubleshooting?</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">Select a component below, or type your specific issue in the box (e.g. "My SSD wear level is high").</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {[
                        { label: "Battery Drain", icon: Battery, query: "battery wear or drain" },
                        { label: "High Thermals", icon: Thermometer, query: "high thermals and overheating" },
                        { label: "Storage Wear", icon: HardDrive, query: "storage wear and degradation" },
                        { label: "CPU Instability", icon: Cpu, query: "cpu throttling and instability" },
                      ].map((q) => (
                        <button
                          key={q.label}
                          onClick={() => handleSubmit(q.query)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all"
                        >
                          <q.icon className="w-4 h-4" />
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "user" ? (
                    <div className="max-w-[80%] px-5 py-3.5 rounded-2xl rounded-br-md bg-primary/15 border border-primary/30 text-sm text-foreground">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="max-w-full md:max-w-[90%] space-y-4 w-full">
                      {msg.text && (
                        <div className="px-5 py-4 rounded-2xl rounded-bl-md bg-card border border-border/50 text-sm text-muted-foreground leading-relaxed">
                          {renderTextWithBoldPaths(msg.text)}
                        </div>
                      )}
                      
                      {msg.solutions?.map((sol, i) => {
                        const urg = URGENCY_COLORS[sol.urgency];
                        return (
                          <div key={i} className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden shadow-sm">
                            <div className="px-5 md:px-6 py-4 border-b border-border/40 flex items-center justify-between gap-4 flex-wrap bg-background/40">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-muted-foreground/60 bg-muted/30 px-2 py-1 rounded tracking-wide">{sol.component}</span>
                                <h3 className="text-base font-bold text-foreground">{sol.title}</h3>
                              </div>
                              <span className={`text-xs font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${urg.bg} ${urg.text}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${urg.text.replace('text-', 'bg-')}`} />
                                {urg.label}
                              </span>
                            </div>
                            
                            <div className="px-5 md:px-6 py-5 space-y-5">
                              {sol.steps.map((step, j) => (
                                <div key={j} className="flex items-start gap-4">
                                  <div className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono font-bold mt-0.5 ${step.type === 'decision' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-primary/10 border-primary/30 text-primary'}`}>
                                    {step.type === 'decision' ? '?' : j + 1}
                                  </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {renderTextWithBoldPaths(step.text)}
                                      </p>
                                      {step.code && <CopyableCode code={step.code} />}
                                      {step.type === 'decision' && (
                                        <div className="flex items-center gap-3 mt-3">
                                          <motion.button 
                                            whileTap={{ scale: 0.9 }} 
                                            transition={{ type: "spring", duration: 0.2 }}
                                            className="px-4 py-1.5 text-xs font-semibold bg-primary/10 border border-primary/30 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                                          >
                                            Yes
                                          </motion.button>
                                          <motion.button 
                                            whileTap={{ scale: 0.9 }} 
                                            transition={{ type: "spring", duration: 0.2 }}
                                            className="px-4 py-1.5 text-xs font-semibold bg-muted/10 border border-border/50 text-muted-foreground rounded-lg hover:bg-muted/20 transition-colors"
                                          >
                                            No
                                          </motion.button>
                                        </div>
                                      )}
                                    </div>
                                </div>
                              ))}
                              
                              <FeedbackWidget messageId={msg.id} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="px-5 py-4 rounded-2xl rounded-bl-md bg-card border border-border/50 flex items-center gap-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-muted-foreground">Formulating exact diagnostic steps…</span>
                  </div>
                </div>
              )}
            </div>

              {/* Input bar */}
              <div className="border-t border-border/50 px-4 md:px-6 py-4 bg-card/80">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSubmit(input); }}
                  className="flex items-center gap-3 relative"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="E.g., 'My NVMe wear level is extremely high'"
                    className="flex-1 bg-background/50 border border-border/50 rounded-xl px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
                    disabled={isTyping}
                  />
                  
                  <div className="flex items-center gap-2 absolute right-2 top-1/2 -translate-y-1/2">
                    {messages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setMessages([]); setInput(""); }}
                        className="p-2 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all"
                        title="Clear conversation"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!input.trim() || isTyping}
                      className="p-2.5 rounded-lg bg-primary text-background hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all glow-cyan mr-1"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>
    </div>
  );
}
