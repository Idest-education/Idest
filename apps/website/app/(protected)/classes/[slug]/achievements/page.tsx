"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMyClassStats } from "@/services/game.service";
import { MyClassStats, MedalCategory } from "@/types/game";

const CATEGORY_LABELS: Record<MedalCategory, string> = {
  WINNING: "Winning",
  STREAK: "Streak",
  LEADERBOARD: "Leaderboard",
  PARTICIPATION: "Participation",
  ACCURACY: "Accuracy",
  SPEED: "Speed",
};

const MEDAL_CATEGORIES: Record<string, MedalCategory> = {
  WINS_3: "WINNING",
  WINS_10: "WINNING",
  WINS_50: "WINNING",
  WINS_100: "WINNING",
  CONSEC_WIN_3: "STREAK",
  CONSEC_WIN_5: "STREAK",
  CONSEC_WIN_10: "STREAK",
  RANK1_WEEK: "LEADERBOARD",
  RANK1_MONTH: "LEADERBOARD",
  GAMES_10: "PARTICIPATION",
  GAMES_50: "PARTICIPATION",
  GAMES_100: "PARTICIPATION",
  ACC_90: "ACCURACY",
  ACC_95: "ACCURACY",
  ACC_100: "ACCURACY",
  SPEED_FAST: "SPEED",
  SPEED_LIGHTNING: "SPEED",
  SPEED_DEMON: "SPEED",
};

export default function AchievementsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<MyClassStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stats = await getMyClassStats(slug);
        setData(stats as MyClassStats);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-20" style={{ background: "#0b0b0b", minHeight: "100vh" }}>
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group earned medals by category
  const earnedByCategory: Partial<Record<MedalCategory, MyClassStats['earned']>> = {};
  for (const medal of data?.earned ?? []) {
    const cat = MEDAL_CATEGORIES[medal.key] ?? "PARTICIPATION";
    if (!earnedByCategory[cat]) earnedByCategory[cat] = [];
    earnedByCategory[cat]!.push(medal);
  }

  // Group progress by category
  const progressByCategory: Partial<Record<MedalCategory, MyClassStats['progress']>> = {};
  for (const p of data?.progress ?? []) {
    const cat = MEDAL_CATEGORIES[p.medalKey] ?? "PARTICIPATION";
    if (!progressByCategory[cat]) progressByCategory[cat] = [];
    progressByCategory[cat]!.push(p);
  }

  const allCategories = Object.keys(CATEGORY_LABELS) as MedalCategory[];

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "#0b0b0b", color: "#fffaf5" }}>
      <h1 className="text-2xl font-bold text-center mb-2">Achievements</h1>

      {data?.stats && (
        <div className="max-w-sm mx-auto mb-8 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-xl font-bold" style={{ color: "#7c3aed" }}>
              {data.stats.totalWins}
            </p>
            <p className="text-xs" style={{ color: "#9ca3af" }}>Wins</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-xl font-bold">{data.stats.totalGames}</p>
            <p className="text-xs" style={{ color: "#9ca3af" }}>Games</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <p className="text-xl font-bold" style={{ color: "#fb923c" }}>{data.earned.length}</p>
            <p className="text-xs" style={{ color: "#9ca3af" }}>Medals</p>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto flex flex-col gap-8">
        {allCategories.map((cat) => {
          const earned = earnedByCategory[cat] ?? [];
          const inProgress = progressByCategory[cat] ?? [];
          if (earned.length === 0 && inProgress.length === 0) return null;

          return (
            <section key={cat}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "#9ca3af" }}>
                {CATEGORY_LABELS[cat]}
              </h2>

              {/* Earned medals */}
              {earned.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {earned.map((medal) => (
                    <div
                      key={medal.key}
                      className="flex flex-col items-center gap-1 rounded-xl p-3 w-20"
                      style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
                    >
                      <span className="text-3xl">{medal.icon}</span>
                      <p className="text-xs font-semibold text-center leading-tight">{medal.name}</p>
                      <p className="text-xs" style={{ color: "#6b7280" }}>
                        {new Date(medal.awardedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress toward unearned medals */}
              {inProgress.length > 0 && (
                <div className="flex flex-col gap-3">
                  {inProgress.map((p) => (
                    <div key={p.medalKey}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs" style={{ color: "#9ca3af" }}>
                          {p.medalKey.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "#7c3aed" }}>
                          {p.current} / {p.target}
                        </span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${p.pct}%`, background: "#7c3aed" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {(data?.earned.length ?? 0) === 0 && (data?.progress.length ?? 0) === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: "#6b7280" }}>
            No achievements yet — play some games to start earning medals!
          </p>
        )}
      </div>
    </div>
  );
}
