"use client";

import { useGameStore } from "@/hooks/useGameStore";

const PODIUM_STYLES = [
  { bg: "rgba(251,191,36,0.15)", border: "#fbbf24", text: "#fbbf24", height: 96, medal: "🥇" },
  { bg: "rgba(148,163,184,0.12)", border: "#94a3b8", text: "#94a3b8", height: 70, medal: "🥈" },
  { bg: "rgba(205,124,47,0.12)", border: "#cd7c2f", text: "#cd7c2f", height: 52, medal: "🥉" },
] as const;

// Display order: 2nd on left, 1st in centre, 3rd on right
const PODIUM_DISPLAY = [1, 0, 2] as const;

export function GameEnded() {
  const leaderboard = useGameStore((s) => s.leaderboard);

  const top3 = leaderboard.slice(0, 3);

  return (
    <div
      className="flex flex-col h-full overflow-y-auto p-4 gap-5"
      style={{ color: "#fffaf5" }}
    >
      {/* Header */}
      <p style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24", textAlign: "center" }}>
        🏆 Final Results
      </p>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex justify-center items-end gap-3">
          {PODIUM_DISPLAY.map((rankIdx) => {
            const entry = top3[rankIdx];
            if (!entry) return <div key={rankIdx} style={{ width: 100 }} />;
            const s = PODIUM_STYLES[rankIdx];
            return (
              <div key={entry.userId} className="flex flex-col items-center" style={{ width: 100 }}>
                {/* Name + medal above platform */}
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: rankIdx === 0 ? 26 : 20 }}>{s.medal}</div>
                  <p
                    style={{
                      fontSize: rankIdx === 0 ? 13 : 12,
                      fontWeight: 700,
                      color: "#fffaf5",
                      marginTop: 4,
                      maxWidth: 96,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.displayName}
                  </p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: s.text, marginTop: 1 }}>
                    {entry.score.toLocaleString()}
                  </p>
                </div>
                {/* Platform */}
                <div
                  style={{
                    width: "100%",
                    height: s.height,
                    background: s.bg,
                    border: `1.5px solid ${s.border}`,
                    borderBottom: "none",
                    borderRadius: "6px 6px 0 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    color: s.text,
                  }}
                >
                  {rankIdx + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ranked list — ALL participants */}
      {leaderboard.length > 0 && (
        <div className="flex flex-col gap-1">
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,250,245,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 4,
            }}
          >
            All Scores
          </p>
          {leaderboard.map((entry, i) => {
            const rankColor =
              i === 0
                ? "#fbbf24"
                : i === 1
                ? "#94a3b8"
                : i === 2
                ? "#cd7c2f"
                : "rgba(255,250,245,0.3)";
            return (
              <div
                key={entry.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background:
                    i === 0
                      ? "rgba(251,191,36,0.08)"
                      : i < 3
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.03)",
                  borderRadius: 7,
                  border: i < 3 ? `1px solid ${rankColor}22` : "1px solid transparent",
                }}
              >
                <span
                  style={{
                    width: 22,
                    fontSize: 12,
                    fontWeight: 700,
                    color: rankColor,
                    flexShrink: 0,
                  }}
                >
                  {entry.rank ?? i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: "#fffaf5" }}>
                  {entry.displayName}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>
                  {entry.score.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {leaderboard.length === 0 && (
        <p style={{ textAlign: "center", color: "rgba(255,250,245,0.3)", fontSize: 14 }}>
          No results available.
        </p>
      )}
    </div>
  );
}
