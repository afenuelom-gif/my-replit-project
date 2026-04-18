// Sub-scores would come from real report data
const OVERALL   = 68;
const SUB_SCORES = [
  { label: "Comm",  value: 72, orbit: 80,  duration: "5s",   startDeg: 30  },
  { label: "Tech",  value: 61, orbit: 108, duration: "8s",   startDeg: 150 },
  { label: "Conf",  value: 74, orbit: 136, duration: "11s",  startDeg: 270 },
];

function getTier(score: number) {
  if (score >= 85) return { label: "Excellent", sub: "Peak Performance",  color: "#10b981", glow: "#6ee7b7" };
  if (score >= 70) return { label: "Good",      sub: "Steady Progress",   color: "#3b82f6", glow: "#93c5fd" };
  if (score >= 55) return { label: "Fair",       sub: "Orbiting Improvement", color: "#3b82f6", glow: "#93c5fd" };
  return              { label: "Needs Work",  sub: "Room to Rise",      color: "#f43f5e", glow: "#fda4af" };
}

export function PlanetOrb() {
  const tier = getTier(OVERALL);
  const SIZE = 320; // total canvas size for orbits
  const cx = SIZE / 2;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <style>{`
        @keyframes orbiter-0 {
          from { transform: rotate(${SUB_SCORES[0].startDeg}deg) translateX(${SUB_SCORES[0].orbit}px) rotate(-${SUB_SCORES[0].startDeg}deg); }
          to   { transform: rotate(${SUB_SCORES[0].startDeg + 360}deg) translateX(${SUB_SCORES[0].orbit}px) rotate(-${SUB_SCORES[0].startDeg + 360}deg); }
        }
        @keyframes orbiter-1 {
          from { transform: rotate(${SUB_SCORES[1].startDeg}deg) translateX(${SUB_SCORES[1].orbit}px) rotate(-${SUB_SCORES[1].startDeg}deg); }
          to   { transform: rotate(${SUB_SCORES[1].startDeg + 360}deg) translateX(${SUB_SCORES[1].orbit}px) rotate(-${SUB_SCORES[1].startDeg + 360}deg); }
        }
        @keyframes orbiter-2 {
          from { transform: rotate(${SUB_SCORES[2].startDeg}deg) translateX(${SUB_SCORES[2].orbit}px) rotate(-${SUB_SCORES[2].startDeg}deg); }
          to   { transform: rotate(${SUB_SCORES[2].startDeg + 360}deg) translateX(${SUB_SCORES[2].orbit}px) rotate(-${SUB_SCORES[2].startDeg + 360}deg); }
        }
        @keyframes orbGlow {
          0%, 100% { box-shadow: 0 0 24px 6px ${tier.glow}55, 0 0 0 0 ${tier.glow}33; }
          50%       { box-shadow: 0 0 40px 14px ${tier.glow}88, 0 0 0 6px ${tier.glow}22; }
        }
        @keyframes satPulse {
          0%, 100% { box-shadow: 0 0 6px 2px ${tier.glow}88; }
          50%       { box-shadow: 0 0 12px 5px ${tier.glow}cc; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "12px" }}>
          Overall Score
        </p>

        {/* Solar system */}
        <div style={{ position: "relative", width: `${SIZE}px`, height: `${SIZE}px` }}>

          {/* Orbital rings (static) */}
          {SUB_SCORES.map((s, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${cx - s.orbit}px`,
              top:  `${cx - s.orbit}px`,
              width:  `${s.orbit * 2}px`,
              height: `${s.orbit * 2}px`,
              borderRadius: "50%",
              border: `1px solid ${tier.color}33`,
              pointerEvents: "none",
            }} />
          ))}

          {/* Satellites */}
          {SUB_SCORES.map((s, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${cx}px`,
              top:  `${cx}px`,
              width: "0",
              height: "0",
              animation: `orbiter-${i} ${s.duration} linear infinite`,
            }}>
              {/* Dot */}
              <div style={{
                position: "absolute",
                width: "38px",
                height: "38px",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: "#ffffff",
                border: `2.5px solid ${tier.color}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                animation: "satPulse 3s ease-in-out infinite",
              }}>
                <span style={{ fontSize: "10px", fontWeight: 800, color: tier.color, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: "7px", fontWeight: 600, color: "#94a3b8", lineHeight: 1.2 }}>{s.label}</span>
              </div>
            </div>
          ))}

          {/* Central orb */}
          <div style={{
            position: "absolute",
            left: `${cx - 60}px`,
            top:  `${cx - 60}px`,
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: `radial-gradient(circle at 38% 38%, #ffffff, ${tier.glow}66 60%, ${tier.color}44)`,
            border: `3px solid ${tier.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "orbGlow 3s ease-in-out infinite",
            zIndex: 10,
          }}>
            <span style={{ fontSize: "42px", fontWeight: 900, color: tier.color, lineHeight: 1 }}>
              {OVERALL}
            </span>
          </div>
        </div>

        {/* Tier label */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", marginTop: "-4px" }}>
          <span style={{ fontSize: "18px", fontWeight: 800, color: tier.color }}>{tier.label}</span>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>{tier.sub}</span>
        </div>
      </div>
    </div>
  );
}
