const SCORE = 68;

function getGrade(score: number) {
  if (score >= 90) return { letter: "A+", label: "Outstanding" };
  if (score >= 80) return { letter: "A",  label: "Excellent" };
  if (score >= 70) return { letter: "B",  label: "Good" };
  if (score >= 60) return { letter: "C",  label: "Fair" };
  if (score >= 50) return { letter: "D",  label: "Below Average" };
  return            { letter: "F",  label: "Needs Work" };
}

export function LetterGrade() {
  const { letter, label } = getGrade(SCORE);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Overall Score</p>
        <div className="flex items-center gap-5 px-8 py-5 rounded-2xl border bg-blue-50 border-blue-200 shadow-sm">
          <div className="w-16 h-16 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-3xl font-black text-white leading-none">{letter}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-blue-700">{label}</span>
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
