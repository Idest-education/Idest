"use client";
import { useState } from "react";

interface MatchPair {
  leftLabel: string;
  rightText: string;
}

interface GameOption {
  id: string;
  label: string;
  text: string;
}

interface GameMatchLRProps {
  options: GameOption[];         // left side items (label + text)
  matchPairs: MatchPair[];       // correct pairs (for labels on right side)
  onSubmit: (pairs: { left: string; right: string }[]) => void;
  disabled?: boolean;
}

export function GameMatchLR({ options, matchPairs, onSubmit, disabled = false }: GameMatchLRProps) {
  // Build right-side unique values from matchPairs
  const rightOptions = [...new Set(matchPairs.map((p) => p.rightText))];

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [connections, setConnections] = useState<Map<string, string>>(new Map());

  function handleLeftTap(label: string) {
    if (disabled) return;
    setSelectedLeft(label === selectedLeft ? null : label);
  }

  function handleRightTap(rightText: string) {
    if (disabled || selectedLeft === null) return;
    setConnections((prev) => new Map(prev).set(selectedLeft, rightText));
    setSelectedLeft(null);
  }

  const allConnected = options.length > 0 && connections.size === options.length;

  function handleSubmit() {
    if (!allConnected || disabled) return;
    const pairs = [...connections.entries()].map(([left, right]) => ({ left, right }));
    onSubmit(pairs);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-2 flex-1">
          {options.map((opt) => {
            const connected = connections.get(opt.label);
            const isSelected = selectedLeft === opt.label;
            return (
              <button
                key={opt.label}
                onClick={() => handleLeftTap(opt.label)}
                disabled={disabled}
                className="rounded-lg px-4 py-3 text-left text-sm font-semibold transition-all"
                style={{
                  background: isSelected ? "#7c3aed" : connected ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.08)",
                  border: `2px solid ${isSelected ? "#7c3aed" : connected ? "#7c3aed" : "rgba(255,255,255,0.15)"}`,
                  color: "#fffaf5",
                }}
              >
                <span className="opacity-60 mr-2">{opt.label}.</span>{opt.text}
                {connected && <span className="ml-2 text-xs opacity-70">→ {connected}</span>}
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-2 flex-1">
          {rightOptions.map((rightText) => {
            const isConnected = [...connections.values()].includes(rightText);
            return (
              <button
                key={rightText}
                onClick={() => handleRightTap(rightText)}
                disabled={disabled || (isConnected && selectedLeft === null)}
                className="rounded-lg px-4 py-3 text-sm font-semibold transition-all"
                style={{
                  background: isConnected ? "rgba(5,150,105,0.3)" : selectedLeft ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.08)",
                  border: `2px solid ${isConnected ? "#059669" : selectedLeft ? "#7c3aed" : "rgba(255,255,255,0.15)"}`,
                  color: "#fffaf5",
                }}
              >
                {rightText}
              </button>
            );
          })}
        </div>
      </div>

      {allConnected && !disabled && (
        <button
          onClick={handleSubmit}
          className="w-full rounded-xl py-3 font-bold text-base transition-all"
          style={{ background: "#7c3aed", color: "#fff" }}
        >
          Submit All ✓
        </button>
      )}
    </div>
  );
}
