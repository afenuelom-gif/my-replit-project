import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Clock, BarChart3, FileText, Briefcase, Upload, CheckCircle2, ChevronRight } from "lucide-react";

const SLIDES = [
  { id: "setup", label: "Configure", step: "01" },
  { id: "interview", label: "Interview", step: "02" },
  { id: "report", label: "Report", step: "03" },
  { id: "feedback", label: "Feedback", step: "04" },
];

function SetupMockup() {
  return (
    <div className="w-full h-full flex flex-col gap-4 p-6 text-left">
      <div className="space-y-0.5">
        <div className="text-sm font-semibold text-white">Session Configuration</div>
        <div className="text-xs text-zinc-500">Define the parameters for your interview simulation.</div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Briefcase className="w-3 h-3 text-blue-400" />
          Target Job Role
        </div>
        <div className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-zinc-300">
          Senior Frontend Engineer
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-zinc-400">Interview Duration</div>
        <div className="flex gap-2">
          {["30 min", "35 min", "40 min", "45 min"].map((d, i) => (
            <div
              key={d}
              className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                i === 1
                  ? "border-blue-500/60 bg-blue-500/20 text-blue-300"
                  : "border-white/10 text-zinc-500"
              }`}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: FileText, label: "Job Description" },
          { icon: Upload, label: "Resume" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <Icon className="w-3 h-3 text-blue-400" />
              {label}
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5">
              <Upload className="w-3 h-3 text-zinc-500" />
              <span className="text-xs text-zinc-500">Upload file</span>
            </div>
            <div className="text-xs text-zinc-600">PDF, DOCX or TXT</div>
          </div>
        ))}
      </div>

      <div className="mt-auto w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold text-center">
        Start Interview Simulation
      </div>
    </div>
  );
}

const INTERVIEWERS = [
  { name: "Sarah Chen", role: "Senior Eng. Manager", color: "from-blue-500 to-cyan-500", initials: "SC", bars: [3, 5, 2, 6, 4, 7, 3, 5] },
  { name: "Marcus Williams", role: "Head of Product", color: "from-purple-500 to-pink-500", initials: "MW", bars: [2, 4, 6, 3, 5, 2, 4, 3] },
  { name: "Elena Rodriguez", role: "VP of Engineering", color: "from-emerald-500 to-teal-500", initials: "ER", bars: [4, 2, 5, 7, 3, 4, 6, 2] },
];

function InterviewMockup() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % INTERVIEWERS.length), 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full h-full flex flex-col gap-3 p-4 text-left">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white">Live Interview</div>
        <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-full px-2.5 py-1">
          <Clock className="w-3 h-3 text-red-400" />
          <span className="text-xs text-zinc-300 font-mono">28:14</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-1">
        {INTERVIEWERS.map((iv, i) => (
          <div
            key={iv.name}
            className={`relative flex flex-col items-center justify-center rounded-xl border p-2 transition-all duration-500 ${
              active === i
                ? "border-blue-500/50 bg-blue-950/30"
                : "border-white/5 bg-white/3"
            }`}
          >
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${iv.color} flex items-center justify-center text-white text-xs font-bold mb-1.5 shadow-lg`}>
              {iv.initials}
            </div>
            {active === i && (
              <div className="flex items-end gap-0.5 h-4 mb-1">
                {iv.bars.map((h, j) => (
                  <motion.div
                    key={j}
                    className="w-0.5 bg-blue-400 rounded-full"
                    animate={{ height: [`${h * 2}px`, `${(iv.bars[(j + 1) % iv.bars.length]) * 2}px`] }}
                    transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse", delay: j * 0.05 }}
                  />
                ))}
              </div>
            )}
            <div className="text-xs text-zinc-300 font-medium text-center leading-tight">{iv.name.split(" ")[0]}</div>
            <div className="text-xs text-zinc-600 text-center leading-tight truncate w-full text-center">{iv.role.split(" ")[0]}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
        <div className="text-xs text-zinc-500 mb-0.5">Current question</div>
        <div className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
          Can you walk me through how you approach performance optimization in a large React application?
        </div>
      </div>

      <div className="flex justify-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Mic className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = [
  { label: "Communication", score: 88, color: "bg-blue-500" },
  { label: "Technical", score: 76, color: "bg-emerald-500" },
  { label: "Confidence", score: 91, color: "bg-amber-500" },
  { label: "Posture", score: 82, color: "bg-purple-500" },
];

function ReportMockup() {
  return (
    <div className="w-full h-full flex flex-col gap-3 p-5 text-left">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-white">Performance Report</div>
          <div className="text-xs text-zinc-500">Senior Frontend Engineer</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">84</div>
          <div className="text-xs text-zinc-500">/ 100</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {CATEGORIES.map((cat) => (
          <div key={cat.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{cat.label}</span>
              <span className="text-zinc-300 font-medium">{cat.score}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${cat.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${cat.score}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-1.5">
        {["Strong technical vocabulary throughout", "Structured answers using STAR method", "Expand on trade-off reasoning"].map((tip, i) => (
          <div key={i} className="flex items-center gap-2">
            <CheckCircle2 className={`w-3 h-3 shrink-0 ${i < 2 ? "text-emerald-400" : "text-amber-400"}`} />
            <span className="text-xs text-zinc-400 leading-tight">{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackMockup() {
  return (
    <div className="w-full h-full flex flex-col gap-3 p-5 text-left">
      <div className="space-y-0.5">
        <div className="text-sm font-semibold text-white">Question Feedback</div>
        <div className="text-xs text-zinc-500 italic leading-relaxed line-clamp-2">
          "Can you walk me through how you handle performance bottlenecks in a large React app?"
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-3">
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
          Strong answer with clear structure. You identified the problem well and proposed concrete solutions. To strengthen further, quantify the impact — e.g. how much did render time improve?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">Strengths</div>
          <ul className="space-y-1.5">
            {[
              "Identified root cause quickly",
              "Mentioned React.memo & useMemo",
              "Structured, logical delivery",
            ].map((s) => (
              <li key={s} className="flex items-start gap-1.5">
                <span className="text-emerald-400 mt-0.5 shrink-0">•</span>
                <span className="text-xs text-zinc-400 leading-tight">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wide">To Improve</div>
          <ul className="space-y-1.5">
            {[
              "Quantify outcomes (e.g. % faster)",
              "Mention profiling tools used",
              "Reduce filler words",
            ].map((s) => (
              <li key={s} className="flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                <span className="text-xs text-zinc-400 leading-tight">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const MOCKUPS = [SetupMockup, InterviewMockup, ReportMockup, FeedbackMockup];

export function ProductPreview() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const t = setInterval(() => {
      setDirection(1);
      setActive((p) => (p + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const goTo = (i: number) => {
    setDirection(i > active ? 1 : -1);
    setActive(i);
  };

  const ActiveMockup = MOCKUPS[active];

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => goTo(i)}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium transition-all border ${
              active === i
                ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                : "border-white/10 bg-white/5 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full text-[9px] sm:text-xs flex items-center justify-center font-bold shrink-0 ${active === i ? "bg-blue-500 text-white" : "bg-white/10 text-zinc-500"}`}>
              {slide.step}
            </span>
            <span className="text-[10px] sm:text-xs">{slide.label}</span>
            {i < SLIDES.length - 1 && <ChevronRight className="hidden sm:block w-3 h-3 text-zinc-600 ml-0.5" />}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-sm shadow-2xl shadow-black/50" style={{ height: 420 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none rounded-2xl" />

        <div className="absolute top-3 left-4 flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        </div>

        <div className="pt-8 pb-10 h-full">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={active}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="h-full"
            >
              <ActiveMockup />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                active === i ? "w-4 h-1.5 bg-blue-400" : "w-1.5 h-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
