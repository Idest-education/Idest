"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/hooks/useGameStore";
import { GameTimer } from "./GameTimer";
import { GameWordCloud } from "./GameWordCloud";
import {
  pauseGame,
  resumeGame,
  extendTimer,
  skipQuestion,
  revealAnswer,
} from "@/services/game.service";

interface GameActiveTeacherProps {
  gameSessionId: string;
  onNext: () => void;
}

export function GameActiveTeacher({ gameSessionId, onNext }: GameActiveTeacherProps) {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const distribution = useGameStore((s) => s.distribution);
  const isPaused = useGameStore((s) => s.isPaused);
  const wordCloudWords = useGameStore((s) => s.wordCloudWords);
  const timerExtended = useGameStore((s) => s.timerExtended);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [prevLeaderboard, setPrevLeaderboard] = useState<typeof leaderboard>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reset timer when question changes
  useEffect(() => {
    if (!currentQuestion) return;
    setElapsedSeconds(currentQuestion.elapsedSeconds ?? 0);
    setPrevLeaderboard(leaderboard);
    setAnswerCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.questionIndex]);

  // Track total players from leaderboard
  useEffect(() => {
    if (leaderboard.length > totalPlayers) setTotalPlayers(leaderboard.length);
  }, [leaderboard, totalPlayers]);

  // Count up elapsed seconds
  useEffect(() => {
    if (!currentQuestion || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentQuestion?.questionIndex, isPaused]);

  // Update answer count from distribution
  useEffect(() => {
    const total = distribution.reduce((s, d) => s + d.count, 0);
    setAnswerCount(total);
  }, [distribution]);

  async function doAction(name: string, fn: () => Promise<unknown>) {
    setActionLoading(name);
    try {
      await fn();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  function getRankChange(userId: string): number {
    const prev = prevLeaderboard.findIndex((e) => e.userId === userId);
    const curr = leaderboard.findIndex((e) => e.userId === userId);
    if (prev === -1 || curr === -1) return 0;
    return prev - curr; // positive = moved up
  }

  const effectiveTimer = timerExtended
    ? timerExtended.newTimerSeconds
    : currentQuestion?.timerSeconds ?? 20;

  if (!currentQuestion) return null;

  const answeredPct =
    totalPlayers > 0 ? Math.round((answerCount / totalPlayers) * 100) : 0;

  return (
    <div
      className="flex gap-4 h-full"
      style={{ background: "#0b0b0b", color: "#fffaf5", padding: "16px" }}
    >
      {/* Left: Question + Controls (60%) */}
      <div className="flex flex-col gap-4" style={{ flex: "0 0 60%" }}>
        {/* Controls bar */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => doAction("skip", () => skipQuestion(gameSessionId))}
            disabled={!!actionLoading}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              background: "rgba(239,68,68,0.2)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            {actionLoading === "skip" ? "…" : "Skip"}
          </button>

          <button
            onClick={() => doAction("extend", () => extendTimer(gameSessionId, 30))}
            disabled={!!actionLoading}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              background: "rgba(245,158,11,0.2)",
              color: "#f59e0b",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            {actionLoading === "extend" ? "…" : "+30s"}
          </button>

          <button
            onClick={() => doAction("reveal", () => revealAnswer(gameSessionId))}
            disabled={!!actionLoading}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              background: "rgba(5,150,105,0.2)",
              color: "#059669",
              border: "1px solid rgba(5,150,105,0.3)",
            }}
          >
            {actionLoading === "reveal" ? "…" : "Reveal"}
          </button>

          <button
            onClick={() =>
              doAction("pause", () =>
                isPaused ? resumeGame(gameSessionId) : pauseGame(gameSessionId)
              )
            }
            disabled={!!actionLoading}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              background: "rgba(124,58,237,0.2)",
              color: "#7c3aed",
              border: "1px solid rgba(124,58,237,0.3)",
            }}
          >
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>

          <button
            onClick={onNext}
            disabled={!!actionLoading}
            className="rounded-lg px-4 py-2 text-sm font-bold ml-auto"
            style={{ background: "#7c3aed", color: "#fff" }}
          >
            Next →
          </button>
        </div>

        {/* Timer + question text */}
        <div className="flex items-center gap-4">
          <GameTimer
            timerSeconds={effectiveTimer}
            elapsedSeconds={elapsedSeconds}
            isPaused={isPaused}
          />
          <div className="flex-1">
            <p className="font-bold text-base">{currentQuestion.text}</p>
            <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
              {answerCount} / {totalPlayers || "?"} answered ({answeredPct}%)
            </p>
          </div>
        </div>

        {/* Live distribution bars */}
        {distribution.length > 0 && (
          <div className="flex flex-col gap-2">
            {distribution.map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="text-xs font-bold w-4">{d.label}</span>
                <div
                  className="flex-1 h-5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${d.pct}%`,
                      background: d.isCorrect ? "#059669" : "#374151",
                    }}
                  />
                </div>
                <span className="text-xs w-8 text-right opacity-60">{d.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Word cloud (visible for WORD_CLOUD questions) */}
        {currentQuestion.type === "WORD_CLOUD" && wordCloudWords.length > 0 && (
          <GameWordCloud words={wordCloudWords} />
        )}
      </div>

      {/* Right: Live leaderboard (40%) */}
      <div className="flex flex-col gap-2" style={{ flex: "0 0 38%" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#9ca3af" }}>
          Live Leaderboard
        </h3>
        <div
          className="flex flex-col gap-1 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          {leaderboard.slice(0, 10).map((entry, i) => {
            const change = getRankChange(entry.userId);
            return (
              <div
                key={entry.userId}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  background:
                    i === 0 ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                }}
              >
                <span
                  className="text-xs font-bold w-5 text-center"
                  style={{ color: "#6b7280" }}
                >
                  #{i + 1}
                </span>
                <span className="flex-1 text-sm truncate">{entry.displayName}</span>
                {change !== 0 && (
                  <span
                    className="text-xs font-bold"
                    style={{ color: change > 0 ? "#059669" : "#ef4444" }}
                  >
                    {change > 0 ? `↑${change}` : `↓${Math.abs(change)}`}
                  </span>
                )}
                <span className="text-xs font-bold" style={{ color: "#7c3aed" }}>
                  {entry.score.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
