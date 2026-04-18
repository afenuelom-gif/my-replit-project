import { TrendingUp, Trophy, ThumbsUp, Dumbbell } from "lucide-react";

const SCORE = 68;

function getTier(score: number) {
  if (score >= 85) return {
    label: "Excellent",
    Icon: Trophy,
    color:       "#059669",
    glow:        "rgba(5,150,105,",
    badgeBg:     "#ecfdf5",
    badgeBorder: "#6ee7b7",
    badgeText:   "#065f46",
  };
  if (score >= 70) return {
    label: "Good",
    Icon: ThumbsUp,
    color:       "#2563eb",
    glow:        "rgba(37,99,235,",
    badgeBg:     "#eff6ff",
    badgeBorder: "#93c5fd",
    badgeText:   "#1e3a8a",
  };
  if (score >= 55) return {
    label: "Fair",
    Icon: TrendingUp,
    color:       "#d97706",
    glow:        "rgba(217,119,6,",
    badgeBg:     "#fffbeb",
    badgeBorder: "#fcd34d",
    badgeText:   "#78350f",
  };
  return {
    label: "Needs Practice",
    Icon: Dumbbell,
    color:       "#e11d48",
    glow:        "rgba(225,29,72,",
    badgeBg:     "#fff1f2",
    badgeBorder: "#fda4af",
    badgeText:   "#881337",
  };
}

const RINGS = [
  { delay: "0s",   duration: "2.4s" },
  { delay: "0.6s", duration: "2.4s" },
  { delay: "1.2s", duration: "2.4s" },
  { delay: "1.8s", duration: "2.4s" },
];

export function PulseRings() {
  const { label, Icon, color, glow, badgeBg, badgeBorder, badgeText } = getTier(SCORE);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}>
      <style>{`
        @keyframes sonarPulse {
          0%   { transform: scale(0.55); opacity: 0.65; }
          100% { transform: scale(1.95); opacity: 0;    }
        }
        @keyframes breathe {
          0%,100% { box-shadow: 0 0 0 0 ${glow}0.25), 0 0 28px 6px ${glow}0.12); }
          50%      { box-shadow: 0 0 0 7px ${glow}0.08), 0 0 44px 14px ${glow}0.22); }
        }
      `}</style>

      {/* Outer card frame */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0px",
        background: "#ffffff",
        border: `1.5px solid ${badgeBorder}`,
        borderRadius: "24px",
        padding: "28px 36px 24px",
        boxShadow: `0 4px 28px ${glow}0.10)`,
      }}>

        {/* Title */}
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 18px" }}>
          Overall Score
        </p>

        {/* Ring container */}
        <div style={{ position: "relative", width: "200px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>

          {/* Sonar rings */}
          {RINGS.map((r, i) => (
            <div key={i} style={{
              position: "absolute",
              width: "120px", height: "120px",
              borderRadius: "50%",
              border: `2px solid ${color}`,
              opacity: 0,
              animation: `sonarPulse ${r.duration} ease-out ${r.delay} infinite`,
            }} />
          ))}

          {/* Static inner glow ring */}
          <div style={{
            position: "absolute",
            width: "150px", height: "150px",
            borderRadius: "50%",
            border: `1.5px solid ${color}`,
            opacity: 0.22,
          }} />

          {/* Score circle */}
          <div style={{
            position: "relative", zIndex: 10,
            width: "120px", height: "120px",
            borderRadius: "50%",
            background: "#ffffff",
            border: `3px solid ${color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "breathe 3s ease-in-out infinite",
          }}>
            <span style={{ fontSize: "44px", fontWeight: 900, color, lineHeight: 1 }}>
              {SCORE}
            </span>
          </div>
        </div>

        {/* Tier badge — framed pill */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "7px",
          marginTop: "20px",
          padding: "8px 18px",
          borderRadius: "999px",
          background: badgeBg,
          border: `1.5px solid ${badgeBorder}`,
          boxShadow: `0 1px 6px ${glow}0.12)`,
        }}>
          <Icon style={{ width: "16px", height: "16px", color }} />
          <span style={{ fontSize: "15px", fontWeight: 700, color: badgeText, letterSpacing: "0.01em" }}>
            {label}
          </span>
        </div>

      </div>
    </div>
  );
}
