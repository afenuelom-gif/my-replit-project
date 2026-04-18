import { Trophy, TrendingUp, ThumbsUp, Dumbbell } from "lucide-react";

const SCORE = 68;

function getTier(score: number) {
  if (score >= 85) return { label: "Excellent", desc: "Outstanding performance", Icon: Trophy };
  if (score >= 70) return { label: "Good", desc: "Solid performance", Icon: ThumbsUp };
  if (score >= 55) return { label: "Fair", desc: "Room to grow", Icon: TrendingUp };
  return { label: "Needs Practice", desc: "Keep at it!", Icon: Dumbbell };
}

export function TierBadge() {
  const { label, desc, Icon } = getTier(SCORE);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Overall Score</p>
        <div className="flex items-center gap-5 px-8 py-5 rounded-2xl border-2 bg-blue-50 border-blue-200 shadow-sm">
          <div className="flex flex-col items-end">
            <span className="text-5xl font-black text-blue-600 leading-none">{SCORE}</span>
            <span className="text-base text-slate-400 font-medium">/100</span>
          </div>
          <div className="w-px h-14 bg-blue-200" />
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-blue-500" />
              <span className="text-lg font-bold text-blue-700">{label}</span>
            </div>
            <span className="text-sm text-slate-500">{desc}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
