"use client";

interface GameHUDProps {
  score: number;
  answerStreak: number;
  rank: number | null;
  totalPlayers?: number;
}

export function GameHUD({ score, answerStreak, rank, totalPlayers }: GameHUDProps) {
  const xp = Math.round(score / 10);

  return (
    <div className="flex items-center justify-between px-4 py-2 rounded-xl"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>

      {/* Score + XP */}
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold" style={{ color: "#fffaf5" }}>
          {score.toLocaleString()} pts
        </span>
        <span className="text-xs" style={{ color: "#9ca3af" }}>{xp} XP</span>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-1">
        <span className="text-xl">🔥</span>
        <span className="text-lg font-bold" style={{ color: answerStreak > 0 ? "#f59e0b" : "#6b7280" }}>
          {answerStreak}
        </span>
      </div>

      {/* Rank */}
      {rank !== null && (
        <div className="flex flex-col items-center">
          <span className="text-xs" style={{ color: "#9ca3af" }}>Rank</span>
          <span className="text-lg font-bold" style={{ color: "#7c3aed" }}>
            #{rank}{totalPlayers ? ` of ${totalPlayers}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
