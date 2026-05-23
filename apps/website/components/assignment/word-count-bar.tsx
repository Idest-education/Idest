interface Props {
  current: number;
  target: number;
}

export default function WordCountBar({ current, target }: Props) {
  const pct = Math.min((current / target) * 100, 100);
  const atTarget = current >= target;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-surface-muted)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: atTarget
              ? "#22c55e"
              : "linear-gradient(90deg, #FF6B35, #fbbf24)",
          }}
        />
      </div>

      {/* Count label */}
      <p
        className="text-xs text-right"
        style={{
          fontFamily: "var(--font-mono, monospace)",
          color: atTarget ? "#22c55e" : "var(--color-text-muted)",
        }}
      >
        {current} / {target} từ tối thiểu
      </p>
    </div>
  );
}
