"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGameStore } from "@/hooks/useGameStore";
import { submitAnswer } from "@/services/game.service";

const OPTION_COLORS = ["#1e3a5f", "#3b1f6b", "#1a3a1a", "#3a1a1a"] as const;

interface GameActiveStudentProps {
  gameSessionId: string;
}

export function GameActiveStudent({ gameSessionId }: GameActiveStudentProps) {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const hasSubmitted = useGameStore((s) => s.hasSubmitted);
  const roundResult = useGameStore((s) => s.roundResult);
  const myScore = useGameStore((s) => s.myScore);
  const myRank = useGameStore((s) => s.myRank);
  const setHasSubmitted = useGameStore((s) => s.setHasSubmitted);
  const [fillText, setFillText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!currentQuestion) return;
    const total = currentQuestion.timerSeconds - (currentQuestion.elapsedSeconds ?? 0);
    setTimeLeft(total);
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
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

  const timerPercent = currentQuestion.timerSeconds > 0
    ? (timeLeft / currentQuestion.timerSeconds) * 100
    : 0;

  if (roundResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div style={{ fontSize: 40 }}>{roundResult.isCorrect ? "✓" : "✗"}</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: roundResult.isCorrect ? "#86efac" : "#f87171" }}>
          {roundResult.isCorrect ? "Correct!" : "Incorrect"}
        </p>
        <p style={{ fontSize: 28, fontWeight: 700, color: "#a78bfa" }}>
          {roundResult.isCorrect ? `+${roundResult.pointsAwarded}` : "0"} pts
        </p>
        {roundResult.correctAnswer && (
          <p style={{ fontSize: 13, color: "rgba(255,250,245,0.5)" }}>
            Answer: <strong style={{ color: "#fffaf5" }}>{roundResult.correctAnswer}</strong>
          </p>
        )}
        <div style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: "12px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)" }}>Total Score</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#fffaf5" }}>{myScore.toLocaleString()}</p>
          {myRank && (
            <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", marginTop: 2 }}>Rank #{myRank}</p>
          )}
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", fontStyle: "italic" }}>
          Waiting for next question...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div style={{ height: 6, background: "#2a2a2a", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${timerPercent}%`,
            background: timerPercent > 30 ? "#7c3aed" : "#ef4444",
            borderRadius: 3,
            transition: "width 1s linear",
          }}
        />
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: "#fffaf5", lineHeight: 1.5 }}>
        {currentQuestion.text}
      </p>

      {currentQuestion.type === "MULTIPLE_CHOICE" ? (
        <div className="grid grid-cols-2 gap-3">
          {currentQuestion.options.map((opt, i) => (
            <button
              key={opt.id}
              disabled={hasSubmitted || submitting}
              onClick={() => handleSubmit(opt.label)}
              style={{
                padding: "14px 10px",
                background: OPTION_COLORS[i % 4],
                borderRadius: 8,
                border: "none",
                cursor: hasSubmitted ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: "#fffaf5",
                opacity: hasSubmitted ? 0.6 : 1,
              }}
            >
              {opt.label} · {opt.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Input
            value={fillText}
            onChange={(e) => setFillText(e.target.value)}
            placeholder="Type your answer..."
            disabled={hasSubmitted}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(fillText)}
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
          />
          <Button
            onClick={() => handleSubmit(fillText)}
            disabled={hasSubmitted || submitting || !fillText.trim()}
            style={{ background: "#7c3aed", color: "white" }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
          </Button>
        </div>
      )}

      {hasSubmitted && !roundResult && (
        <p style={{ fontSize: 12, color: "rgba(255,250,245,0.5)", fontStyle: "italic", textAlign: "center" }}>
          Answer submitted! Waiting for results...
        </p>
      )}
    </div>
  );
}
