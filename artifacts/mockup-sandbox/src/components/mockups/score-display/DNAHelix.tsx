import { useEffect, useRef } from "react";

const SCORE = 68;

// Competency segments mapped along the helix
const SEGMENTS = [
  { label: "Clarity",      value: 72 },
  { label: "Confidence",   value: 74 },
  { label: "Structure",    value: 65 },
  { label: "Technical",    value: 61 },
  { label: "Empathy",      value: 70 },
  { label: "Conciseness",  value: 63 },
  { label: "Depth",        value: 59 },
  { label: "Delivery",     value: 68 },
];

function getTier(s: number) {
  if (s >= 85) return { label: "Excellent",    sub: "Peak Genetic Expression",     color: "#10b981", glow: "#6ee7b7" };
  if (s >= 70) return { label: "Good",         sub: "Strong Strand Alignment",     color: "#3b82f6", glow: "#93c5fd" };
  if (s >= 55) return { label: "Fair",          sub: "Developing Strengths",        color: "#3b82f6", glow: "#93c5fd" };
  return            { label: "Needs Practice", sub: "Rebuilding Core Strands",     color: "#f43f5e", glow: "#fda4af" };
}

const W = 130, H = 280;
const CX = W / 2, A = 44, TURNS = 2.2;
const CURVE_PTS = 120;
const RUNG_COUNT = SEGMENTS.length;

export function DNAHelix() {
  const tier = getTier(SCORE);
  const canvasRef = useRef<SVGSVGElement>(null);
  const offsetRef = useRef(0);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const svg = canvasRef.current;
    if (!svg) return;

    function draw() {
      const o = offsetRef.current;
      if (!svg) return;

      // Build left strand path
      const lPts: string[] = [];
      const rPts: string[] = [];
      for (let i = 0; i <= CURVE_PTS; i++) {
        const pct = i / CURVE_PTS;
        const t   = pct * Math.PI * 2 * TURNS + o;
        const y   = 8 + pct * (H - 16);
        const lx  = CX + A * Math.sin(t);
        const rx  = CX + A * Math.sin(t + Math.PI);
        lPts.push(`${i === 0 ? "M" : "L"}${lx.toFixed(1)},${y.toFixed(1)}`);
        rPts.push(`${i === 0 ? "M" : "L"}${rx.toFixed(1)},${y.toFixed(1)}`);
      }

      const lPath = svg.querySelector("#lStrand") as SVGPathElement;
      const rPath = svg.querySelector("#rStrand") as SVGPathElement;
      if (lPath) lPath.setAttribute("d", lPts.join(" "));
      if (rPath) rPath.setAttribute("d", rPts.join(" "));

      // Update rungs
      for (let i = 0; i < RUNG_COUNT; i++) {
        const pct = (i + 0.5) / RUNG_COUNT;
        const t   = pct * Math.PI * 2 * TURNS + o;
        const y   = 8 + pct * (H - 16);
        const lx  = CX + A * Math.sin(t);
        const rx  = CX + A * Math.sin(t + Math.PI);
        const depth = Math.sin(t); // -1..1 for z-depth feel
        const seg   = SEGMENTS[i];
        const intensity = seg.value / 100;

        const rung = svg.querySelector(`#rung-${i}`) as SVGLineElement;
        const dotL = svg.querySelector(`#dotL-${i}`) as SVGCircleElement;
        const dotR = svg.querySelector(`#dotR-${i}`) as SVGCircleElement;
        if (!rung || !dotL || !dotR) continue;

        rung.setAttribute("x1", lx.toFixed(1));
        rung.setAttribute("y1", y.toFixed(1));
        rung.setAttribute("x2", rx.toFixed(1));
        rung.setAttribute("y2", y.toFixed(1));
        rung.setAttribute("opacity", (0.3 + intensity * 0.55 + (depth > 0 ? 0.15 : 0)).toFixed(2));
        rung.setAttribute("stroke-width", (1 + intensity * 1.5).toFixed(1));

        dotL.setAttribute("cx", lx.toFixed(1));
        dotL.setAttribute("cy", y.toFixed(1));
        dotL.setAttribute("r", (3 + intensity * 2.5 + (depth > 0 ? 1 : 0)).toFixed(1));
        dotL.setAttribute("opacity", (0.5 + intensity * 0.5).toFixed(2));

        dotR.setAttribute("cx", rx.toFixed(1));
        dotR.setAttribute("cy", y.toFixed(1));
        dotR.setAttribute("r", (3 + intensity * 2.5 + (depth < 0 ? 1 : 0)).toFixed(1));
        dotR.setAttribute("opacity", (0.5 + intensity * 0.5).toFixed(2));
      }

      offsetRef.current += 0.022;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <style>{`
        @keyframes scoreBreath {
          0%,100% { text-shadow: 0 0 8px ${tier.color}55; }
          50%      { text-shadow: 0 0 22px ${tier.color}aa; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "24px", background: "#ffffff", border: `1.5px solid ${tier.color}33`, borderRadius: "22px", padding: "28px 24px", boxShadow: `0 4px 24px ${tier.color}18` }}>

        {/* Left: score + label */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px", minWidth: "140px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
            Overall Score
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span style={{ fontSize: "56px", fontWeight: 900, color: tier.color, lineHeight: 1, animation: "scoreBreath 3s ease-in-out infinite" }}>
              {SCORE}
            </span>
            <span style={{ fontSize: "18px", color: "#cbd5e1", fontWeight: 600 }}>/100</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "6px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: tier.color }}>{tier.label}</span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{tier.sub}</span>
          </div>

          {/* Mini segment legend */}
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
            {SEGMENTS.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: tier.color, opacity: 0.4 + (s.value / 100) * 0.6, flexShrink: 0 }} />
                <span style={{ fontSize: "10px", color: "#64748b", flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: "10px", fontWeight: 700, color: tier.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: animated helix */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg ref={canvasRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <filter id="helixGlow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Strand paths */}
            <path id="lStrand" d="" fill="none" stroke={tier.color} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" filter="url(#helixGlow)" />
            <path id="rStrand" d="" fill="none" stroke={tier.glow}   strokeWidth="2.5" strokeLinecap="round" opacity="0.6" filter="url(#helixGlow)" />

            {/* Rung lines */}
            {SEGMENTS.map((_, i) => (
              <line key={i} id={`rung-${i}`} stroke={tier.color} strokeLinecap="round" opacity="0.5" />
            ))}

            {/* Strand dots */}
            {SEGMENTS.map((_, i) => (
              <g key={i}>
                <circle id={`dotL-${i}`} fill={tier.color} filter="url(#helixGlow)" />
                <circle id={`dotR-${i}`} fill={tier.glow}   filter="url(#helixGlow)" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
