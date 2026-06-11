"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { getSessionStats, exportSession } from "@/services/game.service";

// ── Inline types for session stats ────────────────────────────────────────

interface QuestionStat {
  questionId: string;
  text: string;
  difficultyScore: number;
  totalAnswers: number;
  correctAnswers: number;
  incorrectAnswers: number;
  avgResponseTimeMs: number;
}

interface SessionStats {
  sessionId: string;
  totalParticipants: number;
  avgAccuracy: number;       // 0–100
  avgResponseTimeMs: number;
  durationMs: number;
  questions: QuestionStat[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (!ms) return "—";
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}m ${secs}s`;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: "20px 24px",
        flex: 1,
        minWidth: 160,
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ color: "#fffaf5", fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function SessionReportPage() {
  const params = useParams();
  const id = params.id as string;

  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getSessionStats(id)
      .then((data: SessionStats) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load session stats");
        setLoading(false);
      });
  }, [id]);

  async function handleExport(format: "csv" | "json") {
    setExporting(format);
    try {
      const data = await exportSession(id, format);
      const blob =
        format === "csv"
          ? new Blob([data], { type: "text/csv" })
          : new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — could add a toast here
    } finally {
      setExporting(null);
    }
  }

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          background: "#0b0b0b",
          color: "#fffaf5",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        ⏳ Loading report…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div
        style={{
          background: "#0b0b0b",
          color: "#fffaf5",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 20, color: "#ef4444" }}>Failed to load report</div>
        {error && <div style={{ color: "#9ca3af", fontSize: 14 }}>{error}</div>}
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const chartData = stats.questions.map((q, i) => ({
    name: `Q${i + 1}`,
    difficulty: Math.round(q.difficultyScore * 100),
  }));

  const topMissed = [...stats.questions]
    .sort((a, b) => b.difficultyScore - a.difficultyScore)
    .slice(0, 3);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: "#0b0b0b",
        color: "#fffaf5",
        minHeight: "100vh",
        padding: "40px 32px",
        fontFamily: "inherit",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>
          Session ID: {id}
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fffaf5" }}>
          Session Analytics Report
        </h1>
      </div>

      {/* ── 1. Summary bar ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 40,
        }}
      >
        <StatCard label="Total Participants" value={String(stats.totalParticipants)} />
        <StatCard label="Avg Accuracy" value={`${Math.round(stats.avgAccuracy)}%`} />
        <StatCard label="Avg Response Time" value={`${Math.round(stats.avgResponseTimeMs)} ms`} />
        <StatCard label="Session Duration" value={formatDuration(stats.durationMs)} />
      </div>

      {/* ── 2. Difficulty chart ────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600, color: "#fffaf5" }}>
          Question Difficulty
        </h2>
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: "24px 16px",
          }}
        >
          <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44)}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 0, right: 32, left: 8, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Difficulty"]}
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  color: "#fffaf5",
                }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <ReferenceLine
                x={50}
                stroke="#6b7280"
                strokeDasharray="4 4"
              />
              <Bar dataKey="difficulty" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.difficulty >= 50 ? "#ef4444" : "#f87171"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 8, textAlign: "center" }}>
            Dashed line = 50% difficulty threshold
          </div>
        </div>
      </section>

      {/* ── 3. Most-missed questions ────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600, color: "#fffaf5" }}>
          Most Challenging Questions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {topMissed.map((q, i) => (
            <div
              key={q.questionId}
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: "#fffaf5",
                    fontSize: 15,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {q.text}
                </div>
                <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
                  Difficulty: {Math.round(q.difficultyScore * 100)}%
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#4ade80", fontSize: 18, fontWeight: 700 }}>
                    {q.correctAnswers}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>Correct</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#ef4444", fontSize: 18, fontWeight: 700 }}>
                    {q.incorrectAnswers}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>Incorrect</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Per-student note ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600, color: "#fffaf5" }}>
          Per-Student Breakdown
        </h2>
        <div
          style={{
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: 12,
            padding: "24px",
            color: "#9ca3af",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          Per-student breakdown available via CSV export below
        </div>
      </section>

      {/* ── 5. Export buttons ────────────────────────────────────────────── */}
      <section>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600, color: "#fffaf5" }}>
          Export Data
        </h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => handleExport("json")}
            disabled={exporting !== null}
            style={{
              background: exporting === "json" ? "#2a2a2a" : "#1a1a1a",
              color: exporting === "json" ? "#6b7280" : "#fffaf5",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: exporting !== null ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {exporting === "json" ? "Exporting…" : "Export JSON"}
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={exporting !== null}
            style={{
              background: exporting === "csv" ? "#2a2a2a" : "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: exporting !== null ? "not-allowed" : "pointer",
              opacity: exporting !== null ? 0.6 : 1,
              transition: "background 0.2s, opacity 0.2s",
            }}
          >
            {exporting === "csv" ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </section>
    </div>
  );
}
