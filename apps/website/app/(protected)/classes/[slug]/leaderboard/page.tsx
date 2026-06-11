"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getClassLeaderboard, getMedalHolders } from "@/services/game.service";
import { ClassStatsEntry } from "@/types/game";

type Period = "weekly" | "monthly" | "all-time";

const PERIODS: { label: string; value: Period }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "All-Time", value: "all-time" },
];

const PODIUM_ORDER = [1, 0, 2]; // display: 2nd, 1st, 3rd
const PODIUM_HEIGHTS = ["h-20", "h-28", "h-16"];
const PODIUM_EMOJIS = ["🥈", "🥇", "🥉"];

export default function ClassLeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [period, setPeriod] = useState<Period>("all-time");
  const [entries, setEntries] = useState<ClassStatsEntry[]>([]);
  const [medalHolderIds, setMedalHolderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const lb = await getClassLeaderboard(slug, period);
        const mh = await getMedalHolders(slug);
        setEntries(lb as ClassStatsEntry[]);
        setMedalHolderIds(new Set((mh as { userIds: string[] }).userIds));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, period]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: "#0b0b0b", color: "#fffaf5" }}>
      <h1 className="text-2xl font-bold text-center mb-6">Class Leaderboard</h1>

      {/* Period tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: period === p.value ? "#7c3aed" : "rgba(255,255,255,0.06)",
              color: period === p.value ? "#fff" : "#9ca3af",
              border: `1px solid ${period === p.value ? "#7c3aed" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-6 mb-8">
              {PODIUM_ORDER.map((idx, displayPos) => {
                const entry = top3[idx];
                if (!entry) return <div key={displayPos} className="w-24" />;
                const isMedalHolder = medalHolderIds.has(entry.userId);
                return (
                  <div key={entry.userId} className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{PODIUM_EMOJIS[displayPos]}</span>
                    <p
                      className="text-sm font-bold text-center max-w-[90px] truncate"
                      style={{ color: isMedalHolder ? "#fb923c" : "#fffaf5" }}
                    >
                      {entry.displayName}
                    </p>
                    <p className="text-xs" style={{ color: "#9ca3af" }}>{entry.points.toLocaleString()} pts</p>
                    <div
                      className={`w-20 rounded-t-xl flex items-start justify-center pt-2 font-bold text-lg ${PODIUM_HEIGHTS[displayPos]}`}
                      style={{
                        background: idx === 0
                          ? "linear-gradient(to top, #7c3aed, #5b21b6)"
                          : idx === 1 ? "linear-gradient(to top, #374151, #1f2937)"
                          : "linear-gradient(to top, #92400e, #78350f)",
                      }}
                    >
                      #{idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full ranked list */}
          <div className="max-w-lg mx-auto flex flex-col gap-1">
            {rest.map((entry) => {
              const isMedalHolder = medalHolderIds.has(entry.userId);
              return (
                <div
                  key={entry.userId}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <span className="text-xs font-bold w-6 text-center" style={{ color: "#6b7280" }}>
                    #{entry.rank}
                  </span>
                  <span
                    className="flex-1 text-sm font-semibold truncate"
                    style={{ color: isMedalHolder ? "#fb923c" : "#fffaf5" }}
                  >
                    {isMedalHolder && <span className="mr-1">🏅</span>}
                    {entry.displayName}
                  </span>
                  <span className="text-xs" style={{ color: "#6b7280" }}>{entry.totalWins}W</span>
                  <span className="text-sm font-bold" style={{ color: "#7c3aed" }}>
                    {entry.points.toLocaleString()}
                  </span>
                </div>
              );
            })}
            {entries.length === 0 && (
              <p className="text-center py-8 text-sm" style={{ color: "#6b7280" }}>
                No games played yet in this class.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
