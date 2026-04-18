const SCORE = 68;

function getGrade(score: number) {
  if (score >= 90) return { letter: "A+", label: "Outstanding", bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", sub: "text-emerald-600" };
  if (score >= 80) return { letter: "A", label: "Excellent", bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", sub: "text-emerald-600" };
  if (score >= 70) return { letter: "B", label: "Good", bg: "bg-blue-500", light: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", sub: "text-blue-600" };
  if (score >= 60) return { letter: "C", label: "Fair", bg: "bg-amber-500", light: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", sub: "text-amber-600" };
  if (score >= 50) return { letter: "D", label: "Below Average", bg: "bg-orange-500", light: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", sub: "text-orange-600" };
  return { letter: "F", label: "Needs Work", bg: "bg-rose-500", light: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", sub: "text-rose-600" };
}

export function LetterGrade() {
  const grade = getGrade(SCORE);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Overall Score</p>
        <div className={`flex items-center gap-5 px-8 py-5 rounded-2xl border ${grade.light} ${grade.border} shadow-sm`}>
          <div className={`w-16 h-16 rounded-xl ${grade.bg} flex items-center justify-center shadow-sm`}>
            <span className="text-3xl font-black text-white leading-none">{grade.letter}</span>
          </div>
          <div className="flex flex-col">
            <span className={`text-xl font-bold ${grade.text}`}>{grade.label}</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-black text-slate-800">{SCORE}</span>
              <span className="text-base text-slate-400 font-medium">/ 100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
