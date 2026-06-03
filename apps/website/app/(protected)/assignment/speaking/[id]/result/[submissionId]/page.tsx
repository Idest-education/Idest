"use client";

import { use, useEffect, useRef, useState } from "react";
import { getSpeakingAssignment, getSpeakingSubmissionResult } from "@/services/assignment.service";
import {
  SpeakingAssignmentDetail,
  SpeakingSubmissionResult,
  SpeakingGradingBreakdown,
  RubricScore,
  SentenceError,
} from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";
import RevelationHeader from "@/components/revelation-header";
import speakingImage from "@/assets/assignment-speaking.png";
import ReactMarkdown from "react-markdown";

interface Props {
  params: Promise<{ id: string; submissionId: string }>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function commentForBand(score: number) {
  if (score >= 8) return "Xuất sắc! Kỹ năng nói của bạn rất ấn tượng.";
  if (score >= 6.5) return "Rất tốt! Bạn đang thành thạo kỹ năng nói.";
  if (score >= 5) return "Khá tốt! Tiếp tục luyện tập để đạt điểm cao hơn.";
  return "Cần cải thiện. Đọc nhận xét để biết hướng luyện tập.";
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

// ── rubric config — warm palette only ────────────────────────────────────────

const RUBRIC_CONFIG = {
  FC: {
    label: "Fluency & Coherence",
    sublabel: "Speaking rate · rhythm · discourse markers",
    accent: "#FF6B35",
    bg: "#fff4ed",
    border: "#ffe8d6",
    track: "#ffe8d6",
    bar: "#FF6B35",
  },
  LR: {
    label: "Lexical Resource",
    sublabel: "Vocab range · word choice · density",
    accent: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    track: "#fde68a",
    bar: "#f59e0b",
  },
  GR: {
    label: "Grammar Range & Accuracy",
    sublabel: "Error rate · sentence complexity",
    accent: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    track: "#fecaca",
    bar: "#dc2626",
  },
  P: {
    label: "Pronunciation",
    sublabel: "Phoneme accuracy · intelligibility · prosody",
    accent: "#c94010",
    bg: "#fff4ed",
    border: "#ffd0bc",
    track: "#ffd0bc",
    bar: "#c94010",
  },
} as const;

function normalizeEvidence(key: string, value: number): number {
  if (value > 1) return Math.min(value, 100);
  return Math.round(value * 100);
}

// ── sub-components ────────────────────────────────────────────────────────────

function RubricCard({
  rubricKey,
  rubric,
  degraded,
}: {
  rubricKey: keyof typeof RUBRIC_CONFIG;
  rubric: RubricScore;
  degraded: boolean;
}) {
  const cfg = RUBRIC_CONFIG[rubricKey];
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: cfg.accent, fontFamily: "var(--font-body)" }}
          >
            {cfg.label}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {cfg.sublabel}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-2xl font-black"
            style={{ color: cfg.accent, fontFamily: "var(--font-display)" }}
          >
            {rubric.band}
          </span>
          {degraded && (
            <span
              className="text-xs rounded px-1.5 py-0.5"
              style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}
            >
              heuristic
            </span>
          )}
        </div>
      </div>
      <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--color-text-secondary)" }}>
        {rubric.feedback}
      </p>
      <div className="space-y-1.5">
        {Object.entries(rubric.feature_evidence).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-xs w-28 truncate capitalize" style={{ color: "var(--color-text-muted)" }}>
              {key.replace(/_/g, " ")}
            </span>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: cfg.track }}>
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${normalizeEvidence(key, val)}%`, backgroundColor: cfg.bar }}
                />
              </div>
              <span
                className="text-xs font-semibold w-12 text-right"
                style={{ color: cfg.accent, fontFamily: "var(--font-mono)" }}
              >
                {typeof val === "number" && val < 2 ? val.toFixed(2) : Math.round(val)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PronunciationSection({
  sentences,
  audioRef,
  hasAudio,
}: {
  sentences: SentenceError[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
  hasAudio: boolean;
}) {
  const [activeSentence, setActiveSentence] = useState<number | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef<(() => void) | null>(null);

  function playSentence(startTime: number, endTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    if (onTimeUpdateRef.current) {
      audio.removeEventListener("timeupdate", onTimeUpdateRef.current);
      onTimeUpdateRef.current = null;
    }
    stopAtRef.current = endTime;
    audio.currentTime = startTime;
    audio.play();
    const onTimeUpdate = () => {
      if (stopAtRef.current !== null && audio.currentTime >= stopAtRef.current) {
        audio.pause();
        stopAtRef.current = null;
        audio.removeEventListener("timeupdate", onTimeUpdate);
        onTimeUpdateRef.current = null;
      }
    };
    onTimeUpdateRef.current = onTimeUpdate;
    audio.addEventListener("timeupdate", onTimeUpdate);
  }

  function highlightTokens(sentence: string, errors: SentenceError["word_errors"]) {
    const wordSeverity = new Map<string, "red" | "amber">();
    for (const e of errors) {
      const w = e.word.toLowerCase();
      const severity = e.score < 40 ? "red" : "amber";
      if (!wordSeverity.has(w) || (severity === "red" && wordSeverity.get(w) === "amber")) {
        wordSeverity.set(w, severity);
      }
    }
    const tokens = sentence.split(/(\s+)/);
    return tokens.map((tok, i) => {
      const clean = tok.replace(/[^a-zA-Z']/g, "").toLowerCase();
      const sev = wordSeverity.get(clean);
      if (!sev) return <span key={i}>{tok}</span>;
      return (
        <span
          key={i}
          className="font-semibold rounded-sm px-0.5"
          style={
            sev === "red"
              ? { backgroundColor: "#fef2f2", textDecoration: "underline", textDecorationColor: "#dc2626", textDecorationStyle: "dotted", color: "#7f1d1d" }
              : { backgroundColor: "#fffbeb", textDecoration: "underline", textDecorationColor: "#d97706", textDecorationStyle: "dotted", color: "#78350f" }
          }
        >
          {tok}
        </span>
      );
    });
  }

  const active = activeSentence !== null ? sentences[activeSentence] : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex justify-between items-center"
        style={{
          backgroundColor: "var(--color-surface-subtle)",
          borderBottom: "1px solid var(--color-border-default)",
        }}
      >
        <div>
          <h2
            className="text-base font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
          >
            Pronunciation — Transcript
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Click a sentence to inspect word-level pronunciation
          </p>
        </div>
        {hasAudio && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Play button seeks audio below
          </span>
        )}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--color-border-default)" }}>

        {/* Left — plain transcript */}
        <div className="p-5">
          <p className="text-sm leading-8" style={{ color: "var(--color-text-primary)" }}>
            {sentences.map((sent, si) => {
              const isActive = activeSentence === si;
              return (
                <span
                  key={si}
                  onClick={() => setActiveSentence(isActive ? null : si)}
                  className="cursor-pointer rounded-sm transition-colors"
                  style={
                    isActive
                      ? { backgroundColor: "#fff4ed", boxShadow: "0 0 0 2px #FF6B35" }
                      : undefined
                  }
                >
                  {sent.sentence}
                  {si < sentences.length - 1 ? " " : ""}
                </span>
              );
            })}
          </p>
        </div>

        {/* Right — detail panel */}
        <div className="p-5 flex flex-col gap-4" style={{ minHeight: "10rem" }}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
                ← Select a sentence to see details
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start gap-3">
                <p className="text-sm font-semibold leading-7 flex-1" style={{ color: "var(--color-text-primary)" }}>
                  {highlightTokens(active.sentence, active.word_errors)}
                </p>
                <button
                  onClick={() => playSentence(active.start_time, active.end_time)}
                  disabled={!hasAudio}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "var(--color-brand)", color: "#ffffff" }}
                  title={hasAudio ? `Play from ${formatTime(active.start_time)}` : "No audio available"}
                >
                  ▶ {formatTime(active.start_time)}
                </button>
              </div>
              {active.word_errors.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No issues detected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {active.word_errors.map((w, wi) => (
                    <div
                      key={wi}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
                      style={{
                        backgroundColor: "var(--color-surface-subtle)",
                        border: `1px solid ${w.score < 40 ? "#fecaca" : "#fde68a"}`,
                      }}
                    >
                      <span className="font-bold" style={{ color: w.score < 40 ? "var(--color-error)" : "#d97706" }}>
                        {w.word}
                      </span>
                      <span className="font-mono" style={{ color: "var(--color-text-muted)" }}>
                        /{w.reference_ipa}/
                      </span>
                      <span style={{ color: "var(--color-text-secondary)" }}>→ {w.fix_hint}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function SpeakingResultPage(props: Props) {
  const { id, submissionId } = use(props.params);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [result, setResult] = useState<SpeakingSubmissionResult | null>(null);
  const [assignment, setAssignment] = useState<SpeakingAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTranscriptPart, setActiveTranscriptPart] = useState(1);

  useEffect(() => {
    async function load() {
      try {
        const [aRes, sRes] = await Promise.all([
          getSpeakingAssignment(id),
          getSpeakingSubmissionResult(submissionId),
        ]);
        setAssignment(aRes);
        const rawData = (sRes as any)?.data ?? sRes;
        setResult(Array.isArray(rawData) ? rawData[0] : rawData);
      } catch (err) {
        console.error("Failed to load speaking result:", err);
        setLoadError("Không thể tải kết quả. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, submissionId]);

  if (loading) return <LoadingScreen />;

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--color-surface-app)" }}>
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}
        >
          <p className="text-xl font-semibold" style={{ color: "var(--color-error)" }}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--color-surface-app)" }}>
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}
        >
          <p className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>Không tìm thấy kết quả</p>
        </div>
      </div>
    );
  }

  const bd: SpeakingGradingBreakdown | undefined = result.grading_breakdown;
  const overallScore = bd?.overall_band ?? result.score;
  const degraded = new Set(bd?.metadata?.degraded_features ?? []);
  const sentenceErrors = bd?.rubrics?.P?.sentence_errors ?? [];
  const hasAudio = !!result.audio_url;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-surface-app)" }}>

      {/* Pending state */}
      {(result.status === "pending" || overallScore == null) && (
        <>
          <RevelationHeader
            score={0}
            catImage={speakingImage}
            comment="Đang chấm điểm — tải lại trang sau ít phút"
            backHref="/assignment"
          />
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div
              className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: "var(--color-surface-subtle)", border: "1.5px solid var(--color-border-default)" }}
            >
              <p className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                Bài thi đang được chấm điểm. Vui lòng quay lại sau.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Failed state */}
      {result.status === "failed" && (
        <>
          <RevelationHeader
            score={0}
            catImage={speakingImage}
            comment="Chấm điểm thất bại. Vui lòng nộp lại."
            backHref="/assignment"
          />
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div
              className="rounded-2xl p-8"
              style={{ backgroundColor: "var(--color-surface-card)", border: "1.5px solid #fecaca" }}
            >
              <p className="font-semibold" style={{ color: "var(--color-error)" }}>Chấm điểm thất bại</p>
              {result.feedback && (
                <p className="text-sm mt-2" style={{ color: "var(--color-text-secondary)" }}>{result.feedback}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Graded state */}
      {result.status === "graded" && overallScore != null && (
        <>
          <RevelationHeader
            score={overallScore}
            catImage={speakingImage}
            comment={commentForBand(overallScore)}
            backHref="/assignment"
          />

          <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

            {/* Rubric grid */}
            {bd && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["FC", "LR", "GR", "P"] as const).map((key) => (
                  <RubricCard
                    key={key}
                    rubricKey={key}
                    rubric={bd.rubrics[key]}
                    degraded={
                      degraded.has(key.toLowerCase()) ||
                      degraded.has(`ollama_${key.toLowerCase()}_gr`) ||
                      ((key === "LR" || key === "GR") && degraded.has("ollama_lr_gr"))
                    }
                  />
                ))}
              </div>
            )}

            {/* Legacy plain feedback fallback */}
            {!bd && result.feedback && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}
              >
                <div
                  className="px-6 py-4"
                  style={{ backgroundColor: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}
                >
                  <h2
                    className="text-base font-bold"
                    style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
                  >
                    Nhận Xét Chi Tiết
                  </h2>
                </div>
                <div className="p-6">
                  <p className="whitespace-pre-line leading-relaxed text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    {result.feedback}
                  </p>
                </div>
              </div>
            )}

            {/* Pronunciation highlights */}
            {sentenceErrors.length > 0 && (
              <PronunciationSection sentences={sentenceErrors} audioRef={audioRef} hasAudio={hasAudio} />
            )}

            {/* Transcripts */}
            {result.transcripts.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}
              >
                <div
                  className="px-6 py-4"
                  style={{ backgroundColor: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}
                >
                  <h2
                    className="text-base font-bold"
                    style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
                  >
                    Bài nói (Transcript)
                  </h2>
                </div>
                <div className="p-6">
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {result.transcripts.map((t) => {
                      const isActive = activeTranscriptPart === t.part_number;
                      return (
                        <button
                          key={t.part_number}
                          onClick={() => setActiveTranscriptPart(t.part_number)}
                          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: isActive ? "var(--color-brand)" : "var(--color-surface-subtle)",
                            color: isActive ? "#ffffff" : "var(--color-text-secondary)",
                            border: `1px solid ${isActive ? "var(--color-brand)" : "var(--color-border-default)"}`,
                          }}
                        >
                          Part {t.part_number}
                        </button>
                      );
                    })}
                  </div>
                  {result.transcripts
                    .filter((t) => t.part_number === activeTranscriptPart)
                    .map((t) => (
                      <div
                        key={t.part_number}
                        className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
                        style={{ backgroundColor: "var(--color-surface-subtle)", color: "var(--color-text-primary)" }}
                      >
                        {t.text}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Audio player */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}
            >
              <div
                className="px-6 py-4"
                style={{ backgroundColor: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}
              >
                <h2
                  className="text-base font-bold"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
                >
                  Bài nói bạn đã nộp
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  Nhấn ▶ trên từng câu ở trên để nghe đoạn đó
                </p>
              </div>
              <div className="p-6">
                {hasAudio ? (
                  <audio ref={audioRef} controls src={result.audio_url} className="w-full" />
                ) : (
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Không tìm thấy audio để phát.</p>
                )}
              </div>
            </div>

            {/* Assignment questions */}
            {assignment && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: "var(--color-surface-card)", border: "1px solid var(--color-border-default)" }}
              >
                <div
                  className="px-6 py-4"
                  style={{ backgroundColor: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}
                >
                  <h2
                    className="text-base font-bold"
                    style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
                  >
                    Đề bài
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Câu hỏi Speaking Parts 1–3
                  </p>
                </div>
                <div className="p-6 space-y-5">
                  {assignment.parts?.map((part) => (
                    <div key={part.part_number}>
                      <h3 className="font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
                        Phần {part.part_number}
                      </h3>
                      <div
                        className="rounded-xl p-4 prose prose-sm max-w-none"
                        style={{
                          backgroundColor: "var(--color-surface-subtle)",
                          border: "1px solid var(--color-border-default)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        <ReactMarkdown>{part.question}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
