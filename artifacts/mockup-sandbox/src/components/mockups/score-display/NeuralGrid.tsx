import { useEffect, useState } from "react";

const SCORE = 68;

function getTier(s: number) {
  if (s >= 85) return { label: "Excellent",    sub: "Peak Signal Achieved",         color: "#10b981", dim: "#d1fae5", line: "#6ee7b7" };
  if (s >= 70) return { label: "Good",         sub: "Strong Patterns Detected",     color: "#3b82f6", dim: "#dbeafe", line: "#93c5fd" };
  if (s >= 55) return { label: "Fair",          sub: "Neural Insights Generated",    color: "#3b82f6", dim: "#dbeafe", line: "#93c5fd" };
  return            { label: "Needs Practice", sub: "Rebuilding Neural Pathways",   color: "#f43f5e", dim: "#ffe4e6", line: "#fda4af" };
}

// Deterministic LCG pseudo-random (seeded so layout is always the same)
function makeLCG(seed: number) {
  let s = seed >>> 0;
  return () => { s = Math.imul(1664525, s) + 1013904223 >>> 0; return s / 4294967295; };
}

const SVG_W = 300, SVG_H = 200;
const COLS = 10, ROWS = 7;
const PAD  = 18;
const cW   = (SVG_W - PAD * 2) / (COLS - 1);
const cH   = (SVG_H - PAD * 2) / (ROWS - 1);

const rng   = makeLCG(42);
const NODES = Array.from({ length: COLS * ROWS }, (_, i) => ({
  id: i,
  x:  PAD + (i % COLS) * cW   + (rng() - 0.5) * 10,
  y:  PAD + Math.floor(i / COLS) * cH + (rng() - 0.5) * 10,
}));

// Mark nodes lit based on distance from SVG center (lit = closer to centre)
const CX = SVG_W / 2, CY = SVG_H / 2;
const byDist = [...NODES].sort((a, b) =>
  Math.hypot(a.x - CX, a.y - CY) - Math.hypot(b.x - CX, b.y - CY)
);
const LIT_COUNT = Math.round((SCORE / 100) * NODES.length);
const LIT_IDS   = new Set(byDist.slice(0, LIT_COUNT).map(n => n.id));

// Edges between nearby nodes
const MAX_EDGE = 52;
const EDGES: [number, number][] = [];
for (let i = 0; i < NODES.length; i++)
  for (let j = i + 1; j < NODES.length; j++) {
    const d = Math.hypot(NODES[i].x - NODES[j].x, NODES[i].y - NODES[j].y);
    if (d < MAX_EDGE) EDGES.push([i, j]);
  }

export function NeuralGrid() {
  const tier = getTier(SCORE);

  // Cycle through lit nodes to "fire" one at a time (neural impulse effect)
  const litArr = byDist.slice(0, LIT_COUNT).map(n => n.id);
  const [activeId, setActiveId] = useState(litArr[0]);
  useEffect(() => {
    let idx = 0;
    const iv = setInterval(() => {
      idx = (idx + 1) % litArr.length;
      setActiveId(litArr[idx]);
    }, 180);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <style>{`
        @keyframes nodeGlow {
          0%,100% { r: 3.5; opacity: 1; }
          50%      { r: 5.5; opacity: 0.7; }
        }
        @keyframes activeNode {
          0%   { r: 4;  opacity: 1;   filter: drop-shadow(0 0 4px ${tier.color}); }
          50%  { r: 7;  opacity: 0.9; filter: drop-shadow(0 0 9px ${tier.color}); }
          100% { r: 4;  opacity: 1;   filter: drop-shadow(0 0 4px ${tier.color}); }
        }
        @keyframes scoreGlow {
          0%,100% { text-shadow: 0 0 12px ${tier.color}66; }
          50%      { text-shadow: 0 0 28px ${tier.color}cc; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px" }}>
          Overall Score
        </p>

        {/* Network card */}
        <div style={{ position: "relative", width: `${SVG_W}px`, height: `${SVG_H}px`, borderRadius: "20px", overflow: "hidden", background: "linear-gradient(135deg,#f8faff,#eef4ff)", border: `1.5px solid ${tier.dim}` }}>
          <svg width={SVG_W} height={SVG_H} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Edges */}
            {EDGES.map(([a, b], i) => {
              const lit = LIT_IDS.has(a) && LIT_IDS.has(b);
              return (
                <line key={i}
                  x1={NODES[a].x} y1={NODES[a].y}
                  x2={NODES[b].x} y2={NODES[b].y}
                  stroke={lit ? tier.line : "#cbd5e1"}
                  strokeWidth={lit ? "1.2" : "0.6"}
                  opacity={lit ? 0.7 : 0.35}
                />
              );
            })}

            {/* Nodes */}
            {NODES.map(n => {
              const lit    = LIT_IDS.has(n.id);
              const active = n.id === activeId;
              return (
                <circle key={n.id}
                  cx={n.x} cy={n.y}
                  r={active ? 6 : lit ? 3.5 : 2}
                  fill={lit ? tier.color : "#94a3b8"}
                  opacity={lit ? (active ? 1 : 0.75) : 0.25}
                  filter={active ? "url(#glow)" : undefined}
                  style={active ? { animation: "activeNode 0.36s ease-in-out" } :
                         lit    ? { animation: `nodeGlow ${2 + (n.id % 5) * 0.4}s ease-in-out infinite` } : undefined}
                />
              );
            })}
          </svg>

          {/* Centre score overlay */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(6px)", borderRadius: "50%", width: "96px", height: "96px", display: "flex", alignItems: "center", justifyContent: "center", border: `2.5px solid ${tier.color}55`, boxShadow: `0 0 20px ${tier.color}33` }}>
              <span style={{ fontSize: "40px", fontWeight: 900, color: tier.color, lineHeight: 1, animation: "scoreGlow 3s ease-in-out infinite" }}>
                {SCORE}
              </span>
            </div>
          </div>
        </div>

        {/* Label */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", marginTop: "14px" }}>
          <span style={{ fontSize: "17px", fontWeight: 800, color: tier.color }}>{tier.label}</span>
          <span style={{ fontSize: "11px", color: "#94a3b8", letterSpacing: "0.04em" }}>{tier.sub}</span>
        </div>
      </div>
    </div>
  );
}
