"use client";

import { UserMonthlyStat, ClassMonthlyStat } from "@/services/analytics.service";

// ── shared helpers ────────────────────────────────────────────────────────

const CHART_W = 360;
const CHART_H = 120;
const PAD_LEFT = 28;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const INNER_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const INNER_H = CHART_H - PAD_TOP - PAD_BOTTOM;

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("vi-VN", { month: "short" });
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg"
      style={{ height: CHART_H, border: "1.5px dashed var(--color-border-default)" }}
    >
      <p
        className="text-xs"
        style={{ color: "var(--color-text-muted)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        {label}
      </p>
    </div>
  );
}

// ── stacked line chart: users by role per month ──────────────────────────

const ROLES = ["ADMIN", "TEACHER", "STUDENT"] as const;
const ROLE_COLORS: Record<string, string> = {
  ADMIN: "#8b5cf6",
  TEACHER: "#3b82f6",
  STUDENT: "#FF6B35",
};
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị",
  TEACHER: "Giáo viên",
  STUDENT: "Học viên",
};

export function UserStackedLineChart({ data }: { data: UserMonthlyStat[] }) {
  if (data.length === 0) return <EmptyChart label="Chưa có dữ liệu người dùng" />;

  const n = data.length;
  const xStep = n > 1 ? INNER_W / (n - 1) : INNER_W;

  // For each point build cumulative stacks: ADMIN (bottom) → TEACHER → STUDENT (top)
  const stacked = data.map((d) => ({
    month: d.month,
    ADMIN: d.ADMIN,
    TEACHER: d.ADMIN + d.TEACHER,
    STUDENT: d.ADMIN + d.TEACHER + d.STUDENT,
  }));

  const maxVal = Math.max(...stacked.map((d) => d.STUDENT), 1);

  function toX(i: number) {
    return PAD_LEFT + (n === 1 ? INNER_W / 2 : i * xStep);
  }
  function toY(v: number) {
    return PAD_TOP + INNER_H - (v / maxVal) * INNER_H;
  }

  // Build filled area paths from ROLES top-to-bottom (fill between consecutive stack layers)
  // Order: STUDENT fills from TEACHER baseline, TEACHER fills from ADMIN baseline, ADMIN fills from 0
  const areaPaths = ROLES.map((role, ri) => {
    const below = ri < ROLES.length - 1 ? ROLES[ri + 1] : null;

    const topPoints = data.map((_, i) => `${toX(i)},${toY(stacked[i][role])}`);
    const botPoints = below
      ? data.map((_, i) => `${toX(i)},${toY(stacked[i][below]!)}`).reverse()
      : data.map((_, i) => `${toX(i)},${toY(0)}`).reverse();

    return {
      role,
      d: `M ${topPoints[0]} L ${topPoints.join(" L ")} L ${botPoints[0]} L ${botPoints.join(" L ")} Z`,
      linePts: topPoints.join(" L "),
    };
  });

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible" }}
      >
        {/* Y grid lines + labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD_LEFT}
              y1={toY(v)}
              x2={CHART_W - PAD_RIGHT}
              y2={toY(v)}
              stroke="var(--color-border-default)"
              strokeWidth={0.5}
              strokeDasharray="3 3"
            />
            <text
              x={PAD_LEFT - 4}
              y={toY(v) + 3}
              textAnchor="end"
              style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, fill: "var(--color-text-muted)" }}
            >
              {v}
            </text>
          </g>
        ))}

        {/* Stacked filled areas */}
        {areaPaths.map(({ role, d }) => (
          <path key={role} d={d} fill={ROLE_COLORS[role]} fillOpacity={0.18} stroke="none" />
        ))}

        {/* Lines on top of fills */}
        {areaPaths.map(({ role, linePts }) => (
          <polyline
            key={`line-${role}`}
            points={linePts}
            fill="none"
            stroke={ROLE_COLORS[role]}
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Dots */}
        {areaPaths.map(({ role, linePts: _ }) =>
          data.map((d, i) => (
            <circle
              key={`dot-${role}-${i}`}
              cx={toX(i)}
              cy={toY(stacked[i][role])}
              r={2.5}
              fill={ROLE_COLORS[role]}
              stroke="var(--color-surface-card)"
              strokeWidth={1.2}
            />
          ))
        )}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={`xl-${i}`}
            x={toX(i)}
            y={CHART_H - 4}
            textAnchor="middle"
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 8, fill: "var(--color-text-muted)" }}
          >
            {formatMonth(d.month)}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {ROLES.map((role) => (
          <div key={role} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: ROLE_COLORS[role] }} />
            <span
              className="text-[11px]"
              style={{ color: "var(--color-text-secondary)", fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {ROLE_LABELS[role]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── line chart: class creation per month ─────────────────────────────────

const CLASS_COLOR = "#10b981";

export function ClassCreationLineChart({ data }: { data: ClassMonthlyStat[] }) {
  if (data.length === 0) return <EmptyChart label="Chưa có dữ liệu lớp học" />;

  const n = data.length;
  const xStep = n > 1 ? INNER_W / (n - 1) : INNER_W;
  const maxVal = Math.max(...data.map((d) => d.count), 1);

  function toX(i: number) {
    return PAD_LEFT + (n === 1 ? INNER_W / 2 : i * xStep);
  }
  function toY(v: number) {
    return PAD_TOP + INNER_H - (v / maxVal) * INNER_H;
  }

  const linePts = data.map((d, i) => `${toX(i)},${toY(d.count)}`).join(" L ");
  const areaD = `M ${toX(0)},${toY(0)} L ${data.map((d, i) => `${toX(i)},${toY(d.count)}`).join(" L ")} L ${toX(n - 1)},${toY(0)} Z`;

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
    >
      {/* Y grid lines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={PAD_LEFT}
            y1={toY(v)}
            x2={CHART_W - PAD_RIGHT}
            y2={toY(v)}
            stroke="var(--color-border-default)"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
          <text
            x={PAD_LEFT - 4}
            y={toY(v) + 3}
            textAnchor="end"
            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8, fill: "var(--color-text-muted)" }}
          >
            {v}
          </text>
        </g>
      ))}

      {/* Fill area */}
      <path d={areaD} fill={CLASS_COLOR} fillOpacity={0.12} stroke="none" />

      {/* Line */}
      <polyline
        points={linePts}
        fill="none"
        stroke={CLASS_COLOR}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + value labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle
            cx={toX(i)}
            cy={toY(d.count)}
            r={3}
            fill={CLASS_COLOR}
            stroke="var(--color-surface-card)"
            strokeWidth={1.5}
          />
          {d.count > 0 && (
            <text
              x={toX(i)}
              y={toY(d.count) - 6}
              textAnchor="middle"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 8,
                fontWeight: 700,
                fill: "var(--color-text-primary)",
              }}
            >
              {d.count}
            </text>
          )}
        </g>
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        <text
          key={`xl-${i}`}
          x={toX(i)}
          y={CHART_H - 4}
          textAnchor="middle"
          style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 8, fill: "var(--color-text-muted)" }}
        >
          {formatMonth(d.month)}
        </text>
      ))}
    </svg>
  );
}
