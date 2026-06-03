"use client";

import { useState } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/hooks/useGameStore";
import { nextQuestion } from "@/services/game.service";

interface GameActiveTeacherProps {
  gameSessionId: string;
  questionCount: number;
}

export function GameActiveTeacher({ gameSessionId, questionCount }: GameActiveTeacherProps) {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const [advancing, setAdvancing] = useState(false);

  const handleNext = async () => {
    setAdvancing(true);
    try {
      await nextQuestion(gameSessionId);
    } finally {
      setAdvancing(false);
    }
  };

  if (!currentQuestion) return null;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: 13, color: "rgba(255,250,245,0.5)" }}>
          Question {currentQuestion.questionIndex + 1} of {questionCount}
        </p>
        <Button size="sm" onClick={handleNext} disabled={advancing} style={{ background: "#7c3aed", color: "white", fontSize: 12 }}>
          {advancing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
          Next Question
        </Button>
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: "#fffaf5", lineHeight: 1.5 }}>
        {currentQuestion.text}
      </p>

      <div className="flex flex-col gap-2 mt-2">
        <p style={{ fontSize: 12, color: "rgba(255,250,245,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>
          Leaderboard
        </p>
        {leaderboard.length === 0 ? (
          <p style={{ fontSize: 13, color: "rgba(255,250,245,0.35)" }}>Waiting for answers...</p>
        ) : (
          leaderboard.slice(0, 10).map((entry, i) => (
            <div
              key={entry.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: i === 0 ? "#2d1f5e" : "#1e1e1e",
                borderRadius: 6,
              }}
            >
              <span style={{ width: 20, fontWeight: 700, color: i === 0 ? "#fbbf24" : "#9ca3af", fontSize: 13 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: "#fffaf5" }}>{entry.displayName}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa" }}>{entry.score.toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
