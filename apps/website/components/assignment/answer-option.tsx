"use client";

interface Props {
  letter: string;
  text: string;
  selected: boolean;
  onSelect: () => void;
}

export default function AnswerOption({ letter, text, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-start gap-3 p-3 rounded-xl text-left"
      style={{
        backgroundColor: selected ? "#FF6B35" : "var(--color-surface-card)",
        border: selected ? "none" : "1px solid var(--color-border-subtle)",
        color: selected ? "#ffffff" : "var(--color-text-primary)",
        transform: selected ? "scale(1.01)" : "scale(1)",
        boxShadow: selected ? "0 4px 16px rgba(255,107,53,0.25)" : "none",
        transition:
          "background-color 150ms, border 150ms, color 150ms, transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 150ms",
      }}
    >
      <span
        className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
        style={{
          backgroundColor: selected ? "rgba(255,255,255,0.2)" : "var(--color-surface-subtle)",
          color: selected ? "#ffffff" : "var(--color-text-secondary)",
        }}
      >
        {letter}
      </span>
      <span className="text-sm leading-relaxed pt-0.5">{text}</span>
    </button>
  );
}
