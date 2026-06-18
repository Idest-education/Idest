"use client";
import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/hooks/useGameStore";
import { GameTimer } from "./GameTimer";
import { GameHUD } from "./GameHUD";
import { GameWordCloud } from "./GameWordCloud";
import { GameMatchLR } from "./GameMatchLR";
import { submitAnswer } from "@/services/game.service";

const OPTION_COLORS: Record<string, { bg: string; border: string }> = {
  A: { bg: "#1d4ed8", border: "#2563eb" },
  B: { bg: "#5b21b6", border: "#7c3aed" },
  C: { bg: "#065f46", border: "#059669" },
  D: { bg: "#92400e", border: "#d97706" },
};

interface GameActiveStudentProps {
  gameSessionId: string;
  userId?: string;
}

export function GameActiveStudent({ gameSessionId, userId: _userId }: GameActiveStudentProps) {
  const {
    currentQuestion,
    myScore,
    myRank,
    hasSubmitted,
    roundResult,
    answerStreak,
    distribution,
    isPaused,
    wordCloudWords,
    leaderboard,
    setHasSubmitted,
    setMyScore,
    setAnswerStreak,
  } = useGameStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [fillInput, setFillInput] = useState("");
  const [wordInput, setWordInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prevRank, setPrevRank] = useState<number | null>(null);
  // Immediate feedback shown right after submit
  const [submitFeedback, setSubmitFeedback] = useState<{ isCorrect: boolean; pointsAwarded: number } | null>(null);
  // 'grade' = showing ✅/❌ briefly; 'waiting' = waiting for teacher to reveal
  const [feedbackPhase, setFeedbackPhase] = useState<"grade" | "waiting">("waiting");
  const [shownPoints, setShownPoints] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset per-question state when new question arrives
  useEffect(() => {
    if (!currentQuestion) return;
    setElapsedSeconds(currentQuestion.elapsedSeconds ?? 0);
    setSelectedOptions(new Set());
    setFillInput("");
    setWordInput("");
    setSubmitting(false);
    setSubmitFeedback(null);
    setFeedbackPhase("waiting");
    setShownPoints(0);
    setPrevRank(myRank);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.questionIndex]);

  // Timer always counts up while question is active (not paused) — keeps running after submit
  useEffect(() => {
    if (!currentQuestion || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.questionIndex, isPaused]);

  // Animate points when submitFeedback arrives (grade phase)
  useEffect(() => {
    if (!submitFeedback) return;
    const target = submitFeedback.pointsAwarded;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 20));
    const t = setInterval(() => {
      current = Math.min(current + step, target);
      setShownPoints(current);
      if (current >= target) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, [submitFeedback]);

  async function doSubmit(answer: string) {
    if (submitting || hasSubmitted) return;
    setSubmitting(true);
    try {
      const res = await submitAnswer(gameSessionId, { answer });
      setHasSubmitted(true);
      setMyScore(myScore + res.pointsAwarded);
      setAnswerStreak(res.answerStreak, res.maxAnswerStreak);
      // Show grade flash immediately
      setSubmitFeedback({ isCorrect: res.isCorrect, pointsAwarded: res.pointsAwarded });
      setFeedbackPhase("grade");
      // After 2s, transition to waiting-for-teacher state
      feedbackTimerRef.current = setTimeout(() => setFeedbackPhase("waiting"), 2000);
    } catch {
      // duplicate submission or session ended — silently ignore
    } finally {
      setSubmitting(false);
    }
  }

  function handleMCSelect(label: string) {
    if (hasSubmitted || submitting) return;
    doSubmit(label);
  }

  function handleMultiToggle(label: string) {
    if (hasSubmitted || submitting) return;
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function handleMultiSubmit() {
    const answer = [...selectedOptions].sort().join(",");
    doSubmit(answer);
  }

  function handleMatchSubmit(pairs: { left: string; right: string }[]) {
    doSubmit(JSON.stringify(pairs));
  }

  if (!currentQuestion) return null;

  const rankChange =
    myRank !== null && prevRank !== null && prevRank !== myRank
      ? prevRank - myRank
      : 0;

  const matchPairsForComponent = (currentQuestion as unknown as { matchPairs?: { leftLabel: string; rightText: string }[] }).matchPairs ?? [];

  return (
    <div
      className="flex flex-col gap-4 h-full overflow-y-auto"
      style={{ background: "#0b0b0b", color: "#fffaf5", padding: "16px" }}
    >
      {/* HUD */}
      <GameHUD
        score={myScore}
        answerStreak={answerStreak}
        rank={myRank}
        totalPlayers={leaderboard.length}
      />

      {/* Timer + Question */}
      <div className="flex flex-col items-center gap-3">
        <GameTimer
          timerSeconds={currentQuestion.timerSeconds}
          elapsedSeconds={elapsedSeconds}
          isPaused={isPaused}
        />
        <p className="text-lg font-bold text-center max-w-lg">{currentQuestion.text}</p>
      </div>

      {/* Answer area */}
      {!hasSubmitted ? (
        <div className="flex flex-col gap-3">
          {currentQuestion.type === "MULTIPLE_CHOICE" &&
            currentQuestion.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleMCSelect(opt.label)}
                disabled={submitting}
                className="rounded-xl px-5 py-4 text-left font-semibold text-base transition-transform active:scale-95"
                style={{
                  background: OPTION_COLORS[opt.label]?.bg ?? "#374151",
                  border: `2px solid ${OPTION_COLORS[opt.label]?.border ?? "#6b7280"}`,
                  color: "#fff",
                }}
              >
                <span className="font-bold mr-3 opacity-80">{opt.label}.</span>
                {opt.text}
              </button>
            ))}

          {currentQuestion.type === "MULTI_CHOICE" && (
            <>
              {currentQuestion.options.map((opt) => {
                const sel = selectedOptions.has(opt.label);
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleMultiToggle(opt.label)}
                    disabled={submitting}
                    className="rounded-xl px-5 py-4 text-left font-semibold text-base transition-all"
                    style={{
                      background: sel
                        ? (OPTION_COLORS[opt.label]?.bg ?? "#374151")
                        : "rgba(255,255,255,0.06)",
                      border: `2px solid ${
                        sel
                          ? (OPTION_COLORS[opt.label]?.border ?? "#6b7280")
                          : "rgba(255,255,255,0.15)"
                      }`,
                      color: "#fff",
                    }}
                  >
                    <span className="mr-3">{sel ? "☑" : "☐"}</span>
                    <span className="font-bold mr-2 opacity-80">{opt.label}.</span>
                    {opt.text}
                  </button>
                );
              })}
              {selectedOptions.size > 0 && (
                <button
                  onClick={handleMultiSubmit}
                  disabled={submitting}
                  className="rounded-xl py-3 font-bold text-base"
                  style={{ background: "#7c3aed", color: "#fff" }}
                >
                  Submit →
                </button>
              )}
            </>
          )}

          {currentQuestion.type === "FILL_BLANK" && (
            <div className="flex gap-2">
              <input
                value={fillInput}
                onChange={(e) => setFillInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && fillInput.trim() && doSubmit(fillInput.trim())
                }
                placeholder="Type your answer…"
                className="flex-1 rounded-xl px-4 py-3 text-base"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fffaf5",
                  outline: "none",
                }}
              />
              <button
                onClick={() => fillInput.trim() && doSubmit(fillInput.trim())}
                disabled={submitting || !fillInput.trim()}
                className="rounded-xl px-5 py-3 font-bold"
                style={{ background: "#7c3aed", color: "#fff" }}
              >
                →
              </button>
            </div>
          )}

          {currentQuestion.type === "MATCH_LR" && (
            <GameMatchLR
              options={currentQuestion.options}
              matchPairs={matchPairsForComponent}
              onSubmit={handleMatchSubmit}
              disabled={submitting}
            />
          )}

          {currentQuestion.type === "WORD_CLOUD" && (
            <div className="flex gap-2">
              <input
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value.replace(/\s/g, ""))}
                placeholder="Type one word…"
                maxLength={30}
                className="flex-1 rounded-xl px-4 py-3 text-base"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#fffaf5",
                  outline: "none",
                }}
              />
              <button
                onClick={() => wordInput.trim() && doSubmit(wordInput.trim())}
                disabled={submitting || !wordInput.trim()}
                className="rounded-xl px-5 py-3 font-bold"
                style={{ background: "#7c3aed", color: "#fff" }}
              >
                →
              </button>
            </div>
          )}
        </div>
      ) : feedbackPhase === "grade" && submitFeedback ? (
        /* Phase 1: brief grade flash (2 seconds) */
        <div className="flex flex-col items-center gap-3 py-8 animate-in fade-in duration-300">
          <div className="text-7xl">{submitFeedback.isCorrect ? "✅" : "❌"}</div>
          <div
            className="text-4xl font-bold"
            style={{ color: submitFeedback.isCorrect ? "#059669" : "#ef4444" }}
          >
            +{shownPoints} pts
          </div>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            {submitFeedback.isCorrect ? "Correct!" : "Incorrect"}
          </p>
        </div>
      ) : !roundResult ? (
        /* Phase 2: waiting for teacher to reveal answer */
        <div className="flex flex-col items-center gap-2 py-6">
          <span className="text-3xl animate-pulse">⏳</span>
          <p className="text-base font-semibold" style={{ color: "#059669" }}>✓ Submitted</p>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            Waiting for teacher to reveal answer…
          </p>
          {currentQuestion.type === "WORD_CLOUD" && wordCloudWords.length > 0 && (
            <GameWordCloud words={wordCloudWords} />
          )}
        </div>
      ) : null}

      {/* Answer reveal overlay — shown after game:question_ended, cleared on game:question_started */}
      {roundResult && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center gap-4 z-50"
          style={{
            background: "rgba(11,11,11,0.95)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="text-6xl">{roundResult.isCorrect ? "✅" : "❌"}</div>
          <div
            className="text-4xl font-bold"
            style={{ color: roundResult.isCorrect ? "#059669" : "#ef4444" }}
          >
            +{shownPoints} pts
          </div>

          {roundResult.correctAnswer && (
            <div
              className="rounded-xl px-6 py-3 text-center"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fffaf5" }}
            >
              <span className="text-xs opacity-60 block mb-1">Correct answer</span>
              <span className="font-bold">{roundResult.correctAnswer}</span>
            </div>
          )}

          {/* Distribution bars */}
          {distribution.length > 0 && (
            <div className="w-full max-w-sm flex flex-col gap-2 px-4">
              {distribution.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="text-xs w-4 font-bold">{d.label}</span>
                  <div
                    className="flex-1 h-5 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${d.pct}%`,
                        background: d.isCorrect ? "#059669" : "#374151",
                      }}
                    />
                  </div>
                  <span className="text-xs w-8 text-right opacity-70">{d.pct}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Rank change */}
          {rankChange !== 0 && (
            <div
              className="text-sm font-semibold"
              style={{ color: rankChange > 0 ? "#7c3aed" : "#ef4444" }}
            >
              {rankChange > 0
                ? `↑ +${rankChange} positions`
                : `↓ ${Math.abs(rankChange)} positions`}
            </div>
          )}

          <p style={{ fontSize: 11, color: "rgba(255,250,245,0.3)", fontStyle: "italic" }}>
            Waiting for teacher to continue…
          </p>
        </div>
      )}
    </div>
  );
}
