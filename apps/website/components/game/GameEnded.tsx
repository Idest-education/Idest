"use client";

import { useGameStore } from "@/hooks/useGameStore";

export function GameEnded() {
  const leaderboard = useGameStore((s) => s.leaderboard);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <p style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", textAlign: "center" }}>
        Final Results 🏆
      </p>

      <div className="flex justify-center items-end gap-4 my-2">
        {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry) => {
          const originalIdx = top3.indexOf(entry!);
          const isFirst = originalIdx === 0;
          return (
            <div key={entry!.userId} style={{ textAlign: "center" }}>
              <div style={{ fontSize: isFirst ? 32 : 22 }}>{medals[originalIdx]}</div>
              <p style={{ fontSize: isFirst ? 13 : 12, fontWeight: isFirst ? 700 : 500, color: "#fffaf5", marginTop: 4 }}>
                {entry!.displayName}
              </p>
              <p style={{ fontSize: 11, color: "#a78bfa" }}>{entry!.score.toLocaleString()}</p>
            </div>
          );
        })}
      </div>

      {rest.map((entry) => (
        <div
          key={entry.userId}
          style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e1e1e", borderRadius: 6 }}
        >
          <span style={{ fontSize: 12, color: "rgba(255,250,245,0.5)" }}>
            {entry.rank}. {entry.displayName}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,250,245,0.5)" }}>
            {entry.score.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
