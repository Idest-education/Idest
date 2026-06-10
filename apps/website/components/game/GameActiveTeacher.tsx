"use client";

import { useState, useEffect } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/hooks/useGameStore";
import { nextQuestion } from "@/services/game.service";

const OPTION_COLORS = ["#1e3a5f", "#3b1f6b", "#1a3a1a", "#3a1a1a"];
const OPTION_COLORS_DIM = [
  "rgba(30,58,95,0.35)",
  "rgba(59,31,107,0.35)",
  "rgba(26,58,26,0.35)",
  "rgba(58,26,26,0.35)",
];

interface GameActiveTeacherProps {
  gameSessionId: string;
  questionCount: number;
}

export function GameActiveTeacher({ gameSessionId, questionCount }: GameActiveTeacherProps) {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const roundResult = useGameStore((s) => s.roundResult);
  const activeSession = useGameStore((s) => s.activeSession);
  const [advancing, setAdvancing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const questionEnded = roundResult !== null;

  const templateAnswer =
    activeSession?.template?.questions?.[currentQuestion?.questionIndex ?? -1]?.correctAnswer;
  const correctAnswer = roundResult?.correctAnswer ?? templateAnswer;

  useEffect(() => {
    if (!currentQuestion) return;
    const total = currentQuestion.timerSeconds - (currentQuestion.elapsedSeconds ?? 0);
    setTimeLeft(total);
    if (questionEnded) return;
    const interval = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [currentQuestion, questionEnded]);

  const handleNext = async () => {
    setAdvancing(true);
    try {
      await nextQuestion(gameSessionId);
    } finally {
      setAdvancing(false);
    }
  };

  if (!currentQuestion) return null;

  const timerPercent =
    currentQuestion.timerSeconds > 0 ? (timeLeft / currentQuestion.timerSeconds) * 100 : 0;
  const timerColor = timerPercent > 40 ? "#7c3aed" : timerPercent > 15 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex h-full overflow-hidden" style={{ color: "#fffaf5" }}>
      {/* ── Left panel: question + options ── */}
      <div
        style={{
          // Shrink to 1/3 after round ends, otherwise take remaining space
          flex: questionEnded ? "0 0 33%" : "1 1 auto",
          minWidth: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transition: "flex 0.5s ease-in-out",
        }}
      >
        {/* Header: counter + timer + next button */}
        <div
          className="flex-shrink-0 px-4 pt-3 pb-3"
          style={{ borderBottom: "1px solid #2a2a2a" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,250,245,0.5)" }}>
              Q {currentQuestion.questionIndex + 1} / {questionCount}
            </span>
            <div className="flex items-center gap-2">
              {!questionEnded && (
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: timerColor, minWidth: 28, textAlign: "right" }}
                >
                  {timeLeft}s
                </span>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                disabled={advancing}
                style={{ background: "#7c3aed", color: "white", fontSize: 12 }}
              >
                {advancing ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                Next
              </Button>
            </div>
          </div>

          <div style={{ height: 4, background: "#2a2a2a", borderRadius: 99, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: questionEnded ? "0%" : `${timerPercent}%`,
                background: timerColor,
                borderRadius: 99,
                transition: "width 1s linear, background 0.5s",
              }}
            />
          </div>
        </div>

        {/* Question body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55 }}>
            {currentQuestion.text}
          </p>

          {currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {currentQuestion.options.map((opt, i) => {
                const isCorrect = correctAnswer ? opt.label === correctAnswer : false;
                return (
                  <div
                    key={opt.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: questionEnded
                        ? isCorrect
                          ? "rgba(22,163,74,0.25)"
                          : OPTION_COLORS_DIM[i % 4]
                        : isCorrect && correctAnswer
                        ? "rgba(22,163,74,0.2)"
                        : OPTION_COLORS[i % 4],
                      border: `1.5px solid ${isCorrect && correctAnswer ? "#22c55e" : "transparent"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transition: "background 0.4s, border-color 0.4s",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color:
                          isCorrect && correctAnswer ? "#86efac" : "rgba(255,250,245,0.5)",
                        width: 14,
                        flexShrink: 0,
                      }}
                    >
                      {opt.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color:
                          questionEnded && !isCorrect
                            ? "rgba(255,250,245,0.3)"
                            : "#fffaf5",
                        flex: 1,
                      }}
                    >
                      {opt.text}
                    </span>
                    {isCorrect && correctAnswer && (
                      <span style={{ fontSize: 12, color: "#86efac" }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {currentQuestion.type === "FILL_BLANK" && (
            <div
              style={{
                borderRadius: 8,
                border: "1px solid #3a2a5a",
                background: "rgba(124,58,237,0.08)",
                padding: "14px 16px",
              }}
            >
              <p style={{ fontSize: 12, color: "rgba(255,250,245,0.4)" }}>Fill in the blank</p>
              {questionEnded && correctAnswer && (
                <p style={{ fontSize: 15, fontWeight: 600, color: "#86efac", marginTop: 6 }}>
                  {correctAnswer}
                </p>
              )}
            </div>
          )}

          {questionEnded && correctAnswer && currentQuestion.type === "MULTIPLE_CHOICE" && (
            <div
              style={{
                background: "rgba(22,163,74,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 8,
                padding: "8px 14px",
              }}
            >
              <p style={{ fontSize: 12, color: "#86efac", fontWeight: 600 }}>
                Correct answer: {correctAnswer}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: live leaderboard ── */}
      <div
        style={{
          // Expand to 2/3 after round ends, otherwise fixed narrow width
          flex: questionEnded ? "0 0 67%" : "0 0 196px",
          borderLeft: "1px solid #2a2a2a",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "flex 0.5s ease-in-out",
        }}
      >
        <div
          className="flex-shrink-0 px-4 pt-3 pb-2"
          style={{ borderBottom: "1px solid #2a2a2a" }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "rgba(255,250,245,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {questionEnded ? "Round Results" : "Live Standings"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-3 flex flex-col gap-1.5">
          {leaderboard.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: "rgba(255,250,245,0.2)",
                textAlign: "center",
                marginTop: 20,
                fontStyle: "italic",
              }}
            >
              Waiting for answers…
            </p>
          ) : (
            leaderboard.map((entry, i) => {
              const rankColor =
                i === 0
                  ? "#fbbf24"
                  : i === 1
                  ? "#94a3b8"
                  : i === 2
                  ? "#cd7c2f"
                  : "rgba(255,250,245,0.25)";
              return (
                <div
                  key={entry.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: questionEnded ? "9px 12px" : "5px 8px",
                    borderRadius: 7,
                    background:
                      i === 0 ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.03)",
                    transition: "padding 0.4s",
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      fontSize: questionEnded ? 13 : 11,
                      fontWeight: 700,
                      color: rankColor,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: questionEnded ? 14 : 12,
                      color: "#fffaf5",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.displayName}
                  </span>
                  <span
                    style={{
                      fontSize: questionEnded ? 14 : 11,
                      fontWeight: 700,
                      color: "#a78bfa",
                      flexShrink: 0,
                    }}
                  >
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
