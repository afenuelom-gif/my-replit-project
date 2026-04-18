import { Trophy, TrendingUp, ThumbsUp, Dumbbell } from "lucide-react";

const SCORE = 68;

function getTier(score: number) {
  if (score >= 85) return { label: "Excellent", desc: "Outstanding performance", icon: Trophy, bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", num: "text-emerald-600", iconColor: "text-emerald-500" };
  if (score >= 70) return { label: "Good", desc: "Solid performance", icon: ThumbsUp, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", num: "text-blue-600", iconColor: "text-blue-500" };
  if (score >= 55) return { label: "Fair", desc: "Room to grow", icon: TrendingUp, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", num: "text-amber-600", iconColor: "text-amber-500" };
  return { label: "Needs Practice", desc: "Keep at it!", icon: Dumbbell, bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", num: "text-rose-600", iconColor: "text-rose-500" };
}

export function TierBadge() {
  const tier = getTier(SCORE);
  const Icon = tier.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Overall Score</p>
        <div className={`flex items-center gap-5 px-8 py-5 rounded-2xl border-2 ${tier.bg} ${tier.border} shadow-sm`}>
          <div className="flex flex-col items-end">
            <span className={`text-5xl font-black ${tier.num} leading-none`}>{SCORE}</span>
            <span className="text-base text-slate-400 font-medium">/100</span>
          </div>
          <div className={`w-px h-14 ${tier.border} bg-current opacity-30`} />
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 ${tier.iconColor}`} />
              <span className={`text-lg font-bold ${tier.text}`}>{tier.label}</span>
            </div>
            <span className="text-sm text-slate-500">{tier.desc}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
