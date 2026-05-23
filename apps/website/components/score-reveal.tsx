"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  score: number;
  suffix?: string;
  duration?: number;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function ScoreReveal({ score, suffix = "", duration = 800 }: Props) {
  const [displayed, setDisplayed] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      setDisplayed(eased * score);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(score);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1200);
      }
    }

    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 200);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [score, duration]);

  const CONFETTI_COLORS = ["#FF6B35", "#fbbf24", "#dc2626", "#FF6B35", "#fbbf24"];

  return (
    <div className="relative inline-flex items-end justify-center">
      {showConfetti &&
        CONFETTI_COLORS.map((color, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-sm pointer-events-none"
            style={{
              backgroundColor: color,
              top: "10%",
              left: `${20 + i * 15}%`,
              animation: "slide-up 0.6s ease-out both",
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}

      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(56px, 8vw, 80px)",
          color: "#FF6B35",
          lineHeight: 1,
        }}
      >
        {displayed.toFixed(1)}
      </span>
      {suffix && (
        <span
          className="mb-2 ml-1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(22px, 3vw, 30px)",
            color: "rgba(255,107,53,0.5)",
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
