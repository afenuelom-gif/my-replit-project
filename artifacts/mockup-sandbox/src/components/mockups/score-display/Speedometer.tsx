const SCORE = 68;

const toRad = (deg: number) => (deg * Math.PI) / 180;

// 270° gauge: starts at lower-left (135°), sweeps clockwise to lower-right (45°=405°)
const CX = 80, CY = 85, R = 60;
const START_DEG = 135; // 0 score
const SWEEP = 270;     // total degrees

function arcPoint(deg: number) {
  return {
    x: CX + R * Math.cos(toRad(deg)),
    y: CY + R * Math.sin(toRad(deg)),
  };
}

function scoreToDeg(score: number) {
  return START_DEG + (score / 100) * SWEEP;
}

function describeArc(fromDeg: number, toDeg: number) {
  const start = arcPoint(fromDeg);
  const end   = arcPoint(toDeg);
  const span  = toDeg - fromDeg;
  const largeArc = span > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const TICKS = [0, 25, 50, 75, 100];

export function Speedometer() {
  const scoreDeg = scoreToDeg(SCORE);
  const needleEnd = {
    x: CX + (R - 8) * Math.cos(toRad(scoreDeg)),
    y: CY + (R - 8) * Math.sin(toRad(scoreDeg)),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">Overall Score</p>
        <div className="bg-white border border-blue-200 rounded-2xl px-6 py-5 shadow-sm flex flex-col items-center gap-2">
          <svg width="160" height="130" viewBox="0 0 160 130">
            {/* Full background track */}
            <path
              d={describeArc(START_DEG, START_DEG + SWEEP)}
              fill="none" stroke="#dbeafe" strokeWidth="10" strokeLinecap="round"
            />
            {/* Score arc */}
            {SCORE > 0 && (
              <path
                d={describeArc(START_DEG, scoreDeg)}
                fill="none" stroke="#3b82f6" strokeWidth="10" strokeLinecap="round"
              />
            )}

            {/* Tick marks */}
            {TICKS.map((t) => {
              const deg = scoreToDeg(t);
              const inner = { x: CX + (R - 14) * Math.cos(toRad(deg)), y: CY + (R - 14) * Math.sin(toRad(deg)) };
              const outer = { x: CX + (R + 2)  * Math.cos(toRad(deg)), y: CY + (R + 2)  * Math.sin(toRad(deg)) };
              const label = { x: CX + (R - 24) * Math.cos(toRad(deg)), y: CY + (R - 24) * Math.sin(toRad(deg)) };
              return (
                <g key={t}>
                  <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                  <text x={label.x} y={label.y} fontSize="8" fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">{t}</text>
                </g>
              );
            })}

            {/* Needle */}
            <line x1={CX} y1={CY} x2={needleEnd.x} y2={needleEnd.y} stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="5" fill="#1d4ed8" />
            <circle cx={CX} cy={CY} r="2.5" fill="white" />
          </svg>

          <div className="flex flex-col items-center -mt-1">
            <span className="text-4xl font-black text-slate-800 leading-none">
              {SCORE}<span className="text-lg font-medium text-slate-400">/100</span>
            </span>
            <span className="text-sm font-semibold mt-0.5 text-blue-600">Overall Score</span>
          </div>
        </div>
      </div>
    </div>
  );
}
