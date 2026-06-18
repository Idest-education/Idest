"use client";

interface MatchPairInput {
  leftText: string;
  rightText: string;
}

interface GameMatchLREditorProps {
  pairs: MatchPairInput[];
  onChange: (pairs: MatchPairInput[]) => void;
}

export function GameMatchLREditor({ pairs, onChange }: GameMatchLREditorProps) {
  const LABELS = ["A", "B", "C", "D", "E", "F"];

  function updatePair(i: number, field: "leftText" | "rightText", value: string) {
    const next = [...pairs];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }

  function addPair() {
    if (pairs.length >= 6) return;
    onChange([...pairs, { leftText: "", rightText: "" }]);
  }

  function removePair(i: number) {
    onChange(pairs.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "#9ca3af" }}>Match pairs</span>
        <button
          type="button"
          onClick={addPair}
          disabled={pairs.length >= 6}
          className="text-xs px-3 py-1 rounded-lg"
          style={{ background: "rgba(124,58,237,0.2)", color: "#7c3aed" }}
        >
          + Add pair
        </button>
      </div>

      {pairs.map((pair, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-xs font-bold w-5 text-center" style={{ color: "#6b7280" }}>{LABELS[i]}</span>
          <input
            value={pair.leftText}
            onChange={(e) => updatePair(i, "leftText", e.target.value)}
            placeholder="Left item"
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#6b7280" }}
          />
          <span style={{ color: "#6b7280" }}>→</span>
          <input
            value={pair.rightText}
            onChange={(e) => updatePair(i, "rightText", e.target.value)}
            placeholder="Right value"
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#6b7280" }}
          />
          <button
            type="button"
            onClick={() => removePair(i)}
            className="text-xs px-2 py-1 rounded"
            style={{ color: "#dc2626" }}
          >
            ✕
          </button>
        </div>
      ))}

      {pairs.length === 0 && (
        <p className="text-xs text-center py-2" style={{ color: "#6b7280" }}>
          No pairs yet — click "+ Add pair"
        </p>
      )}
    </div>
  );
}
