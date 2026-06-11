"use client";

import { useGameStore } from "@/hooks/useGameStore";

const PODIUM_AVATARS = ["🥇", "🥈", "🥉"];
const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd display order (indices into top3)
const PODIUM_HEIGHTS = ["h-20", "h-28", "h-16"]; // 2nd shorter, 1st tallest, 3rd shortest

interface GameEndedProps {
  userId?: string;
  totalQuestions?: number;
  correctAnswers?: number;
}

export function GameEnded({ userId, totalQuestions, correctAnswers }: GameEndedProps) {
  const { leaderboard, myScore, maxAnswerStreak } = useGameStore();
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const myEntry = userId ? leaderboard.find((e) => e.userId === userId) : undefined;
  const accuracy =
    totalQuestions && correctAnswers !== undefined
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6 py-6" style={{ background: "#0b0b0b", color: "#fffaf5" }}>
      <h2 className="text-2xl font-bold text-center">Game Over!</h2>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-4">
          {PODIUM_ORDER.map((idx, displayPos) => {
            const entry = top3[idx];
            if (!entry) return <div key={displayPos} className="w-24" />;
            return (
              <div key={entry.userId} className="flex flex-col items-center gap-2">
                <span className="text-3xl">{PODIUM_AVATARS[idx]}</span>
                <p className="text-xs font-semibold text-center max-w-[80px] truncate">
                  {entry.displayName}
                </p>
                <p className="text-xs" style={{ color: "#9ca3af" }}>
                  {entry.score.toLocaleString()} pts
                </p>
                <div
                  className={`w-20 rounded-t-lg flex items-end justify-center pb-2 ${PODIUM_HEIGHTS[displayPos]}`}
                  style={{
                    background:
                      idx === 0
                        ? "linear-gradient(to top, #7c3aed, #5b21b6)"
                        : idx === 1
                        ? "linear-gradient(to top, #374151, #1f2937)"
                        : "linear-gradient(to top, #92400e, #78350f)",
                  }}
                >
                  <span className="text-lg font-bold">#{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="flex flex-col gap-1 px-4">
          {rest.map((entry) => (
            <div
              key={entry.userId}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{
                background:
                  userId && entry.userId === userId
                    ? "rgba(124,58,237,0.2)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              <span
                className="text-xs w-6 font-bold text-center"
                style={{ color: "#6b7280" }}
              >
                #{entry.rank}
              </span>
              <span className="flex-1 text-sm truncate">{entry.displayName}</span>
              <span className="text-xs font-bold" style={{ color: "#7c3aed" }}>
                {entry.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Personal summary */}
      {myEntry && (
        <div
          className="mx-4 rounded-xl p-4 flex flex-col gap-3"
          style={{
            background: "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.3)",
          }}
        >
          <h3 className="text-sm font-bold" style={{ color: "#7c3aed" }}>
            Your Session
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="text-xs" style={{ color: "#9ca3af" }}>
                Score
              </span>
              <span className="text-lg font-bold">
                {myEntry.score.toLocaleString()} pts
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs" style={{ color: "#9ca3af" }}>
                XP Gained
              </span>
              <span className="text-lg font-bold" style={{ color: "#7c3aed" }}>
                +{Math.round(myEntry.score / 10)} XP
              </span>
            </div>
            {accuracy !== null && (
              <div className="flex flex-col">
                <span className="text-xs" style={{ color: "#9ca3af" }}>
                  Accuracy
                </span>
                <span className="text-lg font-bold">{accuracy}%</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-xs" style={{ color: "#9ca3af" }}>
                Best Streak
              </span>
              <span className="text-lg font-bold">🔥 {maxAnswerStreak}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
