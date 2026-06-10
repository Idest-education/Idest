"use client";

import { UserRoleStat, SessionMonthStat } from "@/services/analytics.service";

const ROLE_COLORS: Record<string, string> = {
  STUDENT: "#FF6B35",
  TEACHER: "#3b82f6",
  ADMIN: "#8b5cf6",
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Học viên",
  TEACHER: "Giáo viên",
  ADMIN: "Quản trị",
};

// ── Donut chart for user roles ────────────────────────────────────────────
export function UserRoleDonut({ data }: { data: UserRoleStat[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <EmptyChart label="Chưa có dữ liệu người dùng" />;

  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 52;
  const innerR = 32;

  let cumulativeAngle = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = startAngle + angle;
    cumulativeAngle = endAngle;
    const color = ROLE_COLORS[d.role] || "#94a3b8";

    // Full-circle case: SVG arc can't draw a complete circle in one command
    if (Math.abs(angle - 2 * Math.PI) < 0.001) {
      const pathD = [
        `M ${cx} ${cy - r}`,
        `A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r}`,
        `L ${cx - 0.001} ${cy - innerR}`,
        `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
        "Z",
      ].join(" ");
      return { ...d, pathD, color };
    }

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const pathD = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");

    return { ...d, pathD, color };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        {slices.map((slice) => (
          <path
            key={slice.role}
            d={slice.pathD}
            fill={slice.color}
            opacity={0.9}
            className="transition-opacity hover:opacity-100"
          />
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-current"
          style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 18, fill: "var(--color-text-primary)" }}
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 9, fill: "var(--color-text-muted)" }}
        >
          tổng số
        </text>
      </svg>

      <div className="space-y-2 flex-1">
        {slices.map((slice) => (
          <div key={slice.role} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: slice.color }} />
            <span
              className="flex-1 text-xs"
              style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {ROLE_LABELS[slice.role] || slice.role}
            </span>
            <span
              className="text-xs font-bold tabular-nums"
              style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--color-text-primary)" }}
            >
              {slice.count}
            </span>
            <span
              className="text-[10px] w-9 text-right"
              style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {total > 0 ? Math.round((slice.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar chart for sessions by month ──────────────────────────────────────
function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("vi-VN", { month: "short" });
}

export function SessionBarChart({ data }: { data: SessionMonthStat[] }) {
  if (data.length === 0) return <EmptyChart label="Chưa có dữ liệu buổi học" />;

  const chartH = 100;
  const barW = 28;
  const gap = 10;
  const labelH = 20;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalW = data.length * (barW + gap) - gap + 8;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${totalW} ${chartH + labelH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
    >
      {data.map((d, i) => {
        const barH = Math.max(4, (d.count / maxCount) * chartH);
        const x = i * (barW + gap) + 4;
        const y = chartH - barH;

        return (
          <g key={d.month}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill="#FF6B35"
              opacity={0.85}
              className="transition-opacity hover:opacity-100"
            />
            {d.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  fill: "var(--color-text-primary)",
                }}
              >
                {d.count}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={chartH + labelH - 4}
              textAnchor="middle"
              style={{
                fontFamily: "Plus Jakarta Sans, sans-serif",
                fontSize: 9,
                fill: "var(--color-text-muted)",
              }}
            >
              {formatMonth(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center h-24 rounded-lg"
      style={{ border: "1.5px dashed var(--color-border-default)" }}
    >
      <p className="text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
        {label}
      </p>
    </div>
  );
}
