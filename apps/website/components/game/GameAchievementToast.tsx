"use client";
import { useEffect } from "react";
import { useGameStore } from "@/hooks/useGameStore";

export function GameAchievementToast() {
  const { recentMedal, setRecentMedal } = useGameStore();

  useEffect(() => {
    if (!recentMedal) return;
    const t = setTimeout(() => setRecentMedal(null), 4500);
    return () => clearTimeout(t);
  }, [recentMedal, setRecentMedal]);

  if (!recentMedal) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl"
      style={{
        background: "linear-gradient(135deg, #5b21b6, #7c3aed)",
        border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
        animation: "slideInRight 0.4s ease-out",
      }}
    >
      <span className="text-4xl">{recentMedal.icon}</span>
      <div>
        <p className="text-xs font-semibold opacity-70 uppercase tracking-wide">Medal Unlocked!</p>
        <p className="font-bold text-base">{recentMedal.name}</p>
        <p className="text-xs opacity-80">{recentMedal.description}</p>
      </div>
      <button
        onClick={() => setRecentMedal(null)}
        className="ml-2 text-white opacity-60 hover:opacity-100 text-lg"
      >
        ×
      </button>
    </div>
  );
}
