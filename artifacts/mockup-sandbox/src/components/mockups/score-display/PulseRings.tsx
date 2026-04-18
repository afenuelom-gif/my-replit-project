import { TrendingUp, Trophy, ThumbsUp, Dumbbell } from "lucide-react";

const SCORE = 68;

function getTier(score: number) {
  if (score >= 85) return { label: "Excellent", Icon: Trophy,    color: "#10b981", glow: "rgba(16,185,129,", bg: "#ecfdf5" };
  if (score >= 70) return { label: "Good",      Icon: ThumbsUp,  color: "#3b82f6", glow: "rgba(59,130,246,", bg: "#eff6ff" };
  if (score >= 55) return { label: "Fair",       Icon: TrendingUp, color: "#3b82f6", glow: "rgba(59,130,246,", bg: "#eff6ff" };
  return              { label: "Needs Work",  Icon: Dumbbell,  color: "#f43f5e", glow: "rgba(244,63,94,",  bg: "#fff1f2" };
}

const RINGS = [
  { delay: "0s",    size: 120, duration: "2.4s" },
  { delay: "0.6s",  size: 120, duration: "2.4s" },
  { delay: "1.2s",  size: 120, duration: "2.4s" },
  { delay: "1.8s",  size: 120, duration: "2.4s" },
];

export function PulseRings() {
  const { label, Icon, color, glow, bg } = getTier(SCORE);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}>
      <style>{`
        @keyframes sonarPulse {
          0%   { transform: scale(0.55); opacity: 0.7; }
          100% { transform: scale(1.9);  opacity: 0;   }
        }
        @keyframes breathe {
          0%, 100% { box-shadow: 0 0 0 0 ${glow}0.3), 0 0 32px 8px ${glow}0.15); }
          50%       { box-shadow: 0 0 0 6px ${glow}0.1), 0 0 48px 16px ${glow}0.25); }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0px" }}>
        {/* Title */}
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "20px" }}>
          Overall Score
        </p>

        {/* Ring container */}
        <div style={{ position: "relative", width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>

          {/* Sonar pulse rings */}
          {RINGS.map((ring, i) => (
            <div key={i} style={{
              position: "absolute",
              width: `${ring.size}px`,
              height: `${ring.size}px`,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              opacity: 0,
              animation: `sonarPulse ${ring.duration} ease-out ${ring.delay} infinite`,
            }} />
          ))}

          {/* Static inner glow ring */}
          <div style={{
            position: "absolute",
            width: "148px",
            height: "148px",
            borderRadius: "50%",
            border: `2px solid ${color}`,
            opacity: 0.25,
          }} />

          {/* Score circle */}
          <div style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            background: "#ffffff",
            border: `3px solid ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "breathe 3s ease-in-out infinite",
            zIndex: 10,
            position: "relative",
          }}>
            <span style={{ fontSize: "44px", fontWeight: 900, color: color, lineHeight: 1 }}>
              {SCORE}
            </span>
          </div>
        </div>

        {/* Tier label */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "20px" }}>
          <Icon style={{ width: "18px", height: "18px", color: color }} />
          <span style={{ fontSize: "17px", fontWeight: 700, color: color }}>{label}</span>
        </div>
      </div>
    </div>
  );
}
