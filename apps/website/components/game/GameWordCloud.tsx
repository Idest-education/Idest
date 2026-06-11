"use client";
import { WordCloudEntry } from "@/types/game";

function hashColor(word: string): string {
  const colors = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"];
  let hash = 0;
  for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

interface GameWordCloudProps {
  words: WordCloudEntry[];
  hiddenWords?: string[];
}

export function GameWordCloud({ words, hiddenWords = [] }: GameWordCloudProps) {
  const visible = words.filter((w) => !hiddenWords.includes(w.text));
  const maxCount = Math.max(1, ...visible.map((w) => w.count));
  const minCount = Math.min(...visible.map((w) => w.count));

  function fontSize(count: number): number {
    if (maxCount === minCount) return 24;
    return Math.round(12 + ((count - minCount) / (maxCount - minCount)) * 24);
  }

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm" style={{ color: "#6b7280" }}>
        Waiting for words…
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 justify-center items-center p-4 min-h-32">
      {visible.map((w) => (
        <span
          key={w.text}
          style={{
            fontSize: `${fontSize(w.count)}px`,
            color: hashColor(w.text),
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
