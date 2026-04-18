const SCORE = 68;

function getZone(score: number) {
  if (score >= 85) return { label: "Excellent", color: "#10b981", track: "#d1fae5" };
  if (score >= 70) return { label: "Good", color: "#3b82f6", track: "#dbeafe" };
  if (score >= 55) return { label: "Fair", color: "#f59e0b", track: "#fef3c7" };
  return { label: "Needs Practice", color: "#f43f5e", track: "#ffe4e6" };
}

export function Speedometer() {
  const zone = getZone(SCORE);
  const SIZE = 140;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 54;
  const strokeW = 12;

  // Half-circle arc: from 180° (left) to 0° (right), sweep via top
  // angle = 180 - score/100 * 180  (180° = left, 0° = right)
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Track arc: full half circle
  const trackStart = { x: cx - R, y: cy };
  const trackEnd   = { x: cx + R, y: cy };

  // Score arc
  const angleDeg = 180 - (SCORE / 100) * 180; // 180° at 0, 0° at 100
  const scoreEndX = cx + R * Math.cos(toRad(angleDeg));
  const scoreEndY = cy - R * Math.sin(toRad(angleDeg));
  const largeArc = SCORE > 50 ? 1 : 0;

  // Needle
  const needleAngleDeg = 180 - (SCORE / 100) * 180;
  const needleLen = R - 6;
  const needleX = cx + needleLen * Math.cos(toRad(needleAngleDeg));
  const needleY = cy - needleLen * Math.sin(toRad(needleAngleDeg));

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Overall Score</p>
        <div className="bg-white border border-slate-200 rounded-2xl px-8 py-5 shadow-sm flex flex-col items-center gap-1">
          <svg width={SIZE} height={SIZE * 0.62} viewBox={`0 0 ${SIZE} ${SIZE * 0.62}`}>
            {/* Track */}
            <path
              d={`M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 0 1 ${trackEnd.x} ${trackEnd.y}`}
              fill="none"
              stroke={zone.track}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d={`M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 ${largeArc} 1 ${scoreEndX} ${scoreEndY}`}
              fill="none"
              stroke={zone.color}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
            {/* Needle */}
            <line
              x1={cx} y1={cy}
              x2={needleX} y2={needleY}
              stroke="#334155"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Pivot */}
            <circle cx={cx} cy={cy} r="5" fill="#334155" />
            {/* Tick labels */}
            <text x={cx - R - 4} y={cy + 14} fontSize="9" fill="#94a3b8" textAnchor="middle">0</text>
            <text x={cx + R + 4} y={cy + 14} fontSize="9" fill="#94a3b8" textAnchor="middle">100</text>
          </svg>

          <div className="flex flex-col items-center -mt-2">
            <span className="text-4xl font-black text-slate-800 leading-none">{SCORE}<span className="text-lg font-medium text-slate-400">/100</span></span>
            <span className="text-sm font-semibold mt-1" style={{ color: zone.color }}>{zone.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
