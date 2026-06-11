"use client";
import { useMemo } from "react";

interface GameTimerProps {
  timerSeconds: number;
  elapsedSeconds: number;
  isPaused?: boolean;
}

export function GameTimer({ timerSeconds, elapsedSeconds, isPaused = false }: GameTimerProps) {
  const remaining = Math.max(0, timerSeconds - elapsedSeconds);
  const pct = timerSeconds > 0 ? remaining / timerSeconds : 0;

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct);

  const color = useMemo(() => {
    if (pct > 0.5) return "#7c3aed";
    if (pct > 0.25) return "#f59e0b";
    return "#ef4444";
  }, [pct]);

  const isPulsing = remaining <= 5 && remaining > 0 && !isPaused;

  return (
    <div className={`relative inline-flex items-center justify-center ${isPulsing ? "animate-pulse" : ""}`}>
      <svg width="120" height="120" className="-rotate-90">
        {/* Background track */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="#1f1f1f"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: isPaused ? "none" : "stroke-dashoffset 0.9s linear, stroke 0.3s ease" }}
        />
      </svg>
      <span className="absolute text-2xl font-bold" style={{ color: "#fffaf5" }}>
        {isPaused ? "⏸" : remaining}
      </span>
    </div>
  );
}
