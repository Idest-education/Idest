"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGameStore } from "@/hooks/useGameStore";
import { submitAnswer } from "@/services/game.service";

const OPTION_COLORS = ["#1e3a5f", "#3b1f6b", "#1a3a1a", "#3a1a1a"];
const OPTION_COLORS_SUBMITTED = [
  "rgba(30,58,95,0.45)",
  "rgba(59,31,107,0.45)",
  "rgba(26,58,26,0.45)",
  "rgba(58,26,26,0.45)",
];

interface GameActiveStudentProps {
  gameSessionId: string;
}

export function GameActiveStudent({ gameSessionId }: GameActiveStudentProps) {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const hasSubmitted = useGameStore((s) => s.hasSubmitted);
  const roundResult = useGameStore((s) => s.roundResult);
  const myScore = useGameStore((s) => s.myScore);
  const setHasSubmitted = useGameStore((s) => s.setHasSubmitted);
  const [fillText, setFillText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!currentQuestion) return;
    setSelectedOption(null);
    setFillText("");
    const total = currentQuestion.timerSeconds - (currentQuestion.elapsedSeconds ?? 0);
    setTimeLeft(total);
    const interval = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  const handleSubmit = async (answer: string) => {
    if (hasSubmitted || submitting) return;
    setSubmitting(true);
    try {
      await submitAnswer(gameSessionId, { answer });
      setHasSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentQuestion) return null;

  const timerPercent =
    currentQuestion.timerSeconds > 0 ? (timeLeft / currentQuestion.timerSeconds) * 100 : 0;
  const timerColor = timerPercent > 40 ? "#7c3aed" : timerPercent > 15 ? "#f59e0b" : "#ef4444";

  // Build a readable correct-answer string for MULTIPLE_CHOICE
  const correctOptionText =
    roundResult && currentQuestion.type === "MULTIPLE_CHOICE"
      ? currentQuestion.options.find((o) => o.label === roundResult.correctAnswer)?.text
      : null;
  const displayCorrectAnswer = correctOptionText
    ? `${roundResult?.correctAnswer} · ${correctOptionText}`
    : roundResult?.correctAnswer;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* ── Question view ── */}
      <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
        {/* Timer */}
        <div style={{ height: 5, background: "#2a2a2a", borderRadius: 99, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${timerPercent}%`,
              background: timerColor,
              borderRadius: 99,
              transition: "width 1s linear, background 0.5s",
            }}
          />
        </div>
        <div className="flex justify-between items-center" style={{ marginTop: -8 }}>
          <span style={{ fontSize: 11, color: "rgba(255,250,245,0.25)" }}>
            Q {currentQuestion.questionIndex + 1}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: timerColor }}>{timeLeft}s</span>
        </div>

        <p style={{ fontSize: 15, fontWeight: 600, color: "#fffaf5", lineHeight: 1.55 }}>
          {currentQuestion.text}
        </p>

        {currentQuestion.type === "MULTIPLE_CHOICE" ? (
          <div className="grid grid-cols-2 gap-3 flex-1">
            {currentQuestion.options.map((opt, i) => {
              const isSelected = selectedOption === opt.label;
              return (
                <button
                  key={opt.id}
                  disabled={hasSubmitted || submitting}
                  onClick={() => {
                    setSelectedOption(opt.label);
                    handleSubmit(opt.label);
                  }}
                  style={{
                    padding: "16px 12px",
                    background: hasSubmitted
                      ? isSelected
                        ? OPTION_COLORS[i % 4]
                        : OPTION_COLORS_SUBMITTED[i % 4]
                      : OPTION_COLORS[i % 4],
                    borderRadius: 10,
                    border: isSelected
                      ? "2px solid rgba(255,250,245,0.45)"
                      : "2px solid transparent",
                    cursor: hasSubmitted ? "default" : "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    color:
                      hasSubmitted && !isSelected ? "rgba(255,250,245,0.3)" : "#fffaf5",
                    textAlign: "left",
                    transition: "background 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.6 }}>{opt.label}</span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Fill-in-the-blank: centered, large */
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <p style={{ fontSize: 13, color: "rgba(255,250,245,0.4)", textAlign: "center" }}>
              Type your answer below
            </p>
            <Input
              value={fillText}
              onChange={(e) => setFillText(e.target.value)}
              placeholder="Your answer…"
              disabled={hasSubmitted}
              onKeyDown={(e) => e.key === "Enter" && !hasSubmitted && handleSubmit(fillText)}
              style={{
                background: "#1e1e1e",
                border: "1px solid #3a2a5a",
                color: "#fffaf5",
                height: 56,
                fontSize: 18,
                textAlign: "center",
                maxWidth: 360,
                width: "100%",
                borderRadius: 10,
              }}
            />
            <Button
              onClick={() => handleSubmit(fillText)}
              disabled={hasSubmitted || submitting || !fillText.trim()}
              style={{
                background: hasSubmitted ? "#2a2a2a" : "#7c3aed",
                color: hasSubmitted ? "rgba(255,250,245,0.4)" : "white",
                height: 48,
                fontSize: 15,
                paddingInline: 40,
                borderRadius: 10,
                transition: "background 0.2s",
              }}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : hasSubmitted ? "Submitted ✓" : "Submit"}
            </Button>
          </div>
        )}

        {hasSubmitted && !roundResult && (
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,250,245,0.35)",
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            Answer submitted — waiting for results…
          </p>
        )}
      </div>

      {/* ── Round result popup overlay ── */}
      {roundResult && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(11,11,11,0.78)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 20,
          }}
        >
          <div
            style={{
              background: "#181818",
              border: `2px solid ${roundResult.isCorrect ? "#22c55e" : "#ef4444"}`,
              borderRadius: 18,
              padding: "28px 32px",
              maxWidth: 320,
              width: "100%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
              boxShadow: `0 0 40px ${roundResult.isCorrect ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: roundResult.isCorrect
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(239,68,68,0.15)",
                border: `2px solid ${roundResult.isCorrect ? "#22c55e" : "#ef4444"}`,
                fontSize: 28,
                color: roundResult.isCorrect ? "#22c55e" : "#ef4444",
              }}
            >
              {roundResult.isCorrect ? "✓" : "✗"}
            </div>

            {/* Points */}
            <div>
              <p
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: roundResult.isCorrect ? "#86efac" : "rgba(255,250,245,0.25)",
                }}
              >
                {roundResult.isCorrect ? `+${roundResult.pointsAwarded}` : "+0"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", marginTop: 4 }}>points</p>
            </div>

            {/* Correct answer — always shown */}
            {displayCorrectAnswer && (
              <div
                style={{
                  background: "rgba(22,163,74,0.12)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  borderRadius: 10,
                  padding: "10px 16px",
                  width: "100%",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: "rgba(134,239,172,0.55)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 5,
                  }}
                >
                  Correct Answer
                </p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#86efac" }}>
                  {displayCorrectAnswer}
                </p>
              </div>
            )}

            {/* Total score only — no rank shown */}
            <div
              style={{
                background: "rgba(124,58,237,0.1)",
                border: "1px solid rgba(124,58,237,0.25)",
                borderRadius: 10,
                padding: "10px 24px",
              }}
            >
              <p style={{ fontSize: 10, color: "rgba(255,250,245,0.35)", marginBottom: 3 }}>
                Total Score
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#fffaf5" }}>
                {myScore.toLocaleString()}
              </p>
            </div>

            <p style={{ fontSize: 11, color: "rgba(255,250,245,0.22)", fontStyle: "italic" }}>
              Waiting for next question…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
