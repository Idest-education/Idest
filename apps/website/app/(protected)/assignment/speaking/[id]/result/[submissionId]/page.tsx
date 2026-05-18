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
import ReactMarkdown from "react-markdown";

interface Props {
  params: Promise<{ id: string; submissionId: string }>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function bandColor(score: number) {
  if (score >= 8) return { text: "text-green-600", border: "border-green-400", bg: "from-green-50 to-emerald-50" };
  if (score >= 6.5) return { text: "text-blue-600", border: "border-blue-400", bg: "from-blue-50 to-indigo-50" };
  if (score >= 5) return { text: "text-yellow-600", border: "border-yellow-400", bg: "from-yellow-50 to-amber-50" };
  return { text: "text-red-600", border: "border-red-400", bg: "from-red-50 to-rose-50" };
}

function bandLabel(score: number) {
  if (score >= 8) return "🎉 Xuất sắc! Người dùng rất tốt";
  if (score >= 6.5) return "👏 Tốt! Người dùng thành thạo";
  if (score >= 5) return "💪 Khá! Người dùng trung bình";
  return "📚 Cần cải thiện! Người dùng hạn chế";
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

// ── rubric config ─────────────────────────────────────────────────────────────

const RUBRIC_CONFIG = {
  FC: {
    label: "Fluency & Coherence",
    sublabel: "Speaking rate · rhythm · discourse markers",
    color: { card: "bg-blue-50 border-blue-200", band: "text-blue-700", bar: "bg-blue-500", track: "bg-blue-100", label: "text-blue-600 font-bold uppercase tracking-wide text-xs" },
  },
  LR: {
    label: "Lexical Resource",
    sublabel: "Vocab range · word choice · density",
    color: { card: "bg-green-50 border-green-200", band: "text-green-700", bar: "bg-green-500", track: "bg-green-100", label: "text-green-600 font-bold uppercase tracking-wide text-xs" },
  },
  GR: {
    label: "Grammar Range & Accuracy",
    sublabel: "Error rate · sentence complexity",
    color: { card: "bg-purple-50 border-purple-200", band: "text-purple-700", bar: "bg-purple-500", track: "bg-purple-100", label: "text-purple-600 font-bold uppercase tracking-wide text-xs" },
  },
  P: {
    label: "Pronunciation",
    sublabel: "Phoneme accuracy · intelligibility · prosody",
    color: { card: "bg-orange-50 border-orange-200", band: "text-orange-700", bar: "bg-orange-400", track: "bg-orange-100", label: "text-orange-600 font-bold uppercase tracking-wide text-xs" },
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
    <div className={`rounded-xl p-4 border ${cfg.color.card}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className={cfg.color.label}>{cfg.label}</div>
          <div className="text-xs text-slate-500">{cfg.sublabel}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-2xl font-black ${cfg.color.band}`}>{rubric.band}</span>
          {degraded && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded px-1.5 py-0.5">
              ⚠ heuristic
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-600 mb-3 leading-relaxed">{rubric.feedback}</p>
      <div className="space-y-1.5">
        {Object.entries(rubric.feature_evidence).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 w-28 truncate capitalize">{key.replace(/_/g, " ")}</span>
            <div className="flex items-center gap-2 flex-1">
              <div className={`flex-1 h-1.5 rounded-full ${cfg.color.track}`}>
                <div
                  className={`h-1.5 rounded-full ${cfg.color.bar}`}
                  style={{ width: `${normalizeEvidence(key, val)}%` }}
                />
              </div>
              <span className={`text-xs font-semibold ${cfg.color.band} w-12 text-right`}>
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

  function highlightSentence(sentence: string, errors: SentenceError["word_errors"]) {
    if (!errors.length) return <span>{sentence}</span>;

    const wordSeverity = new Map<string, "red" | "amber">();
    for (const e of errors) {
      const w = e.word.toLowerCase();
      const severity = e.score < 40 ? "red" : "amber";
      if (!wordSeverity.has(w) || (severity === "red" && wordSeverity.get(w) === "amber")) {
        wordSeverity.set(w, severity);
      }
    }

    const tokens = sentence.split(/(\s+)/);
    return (
      <>
        {tokens.map((tok, i) => {
          const clean = tok.replace(/[^a-zA-Z']/g, "").toLowerCase();
          const sev = wordSeverity.get(clean);
          if (!sev) return <span key={i}>{tok}</span>;
          return (
            <span
              key={i}
              className={
                sev === "red"
                  ? "bg-red-100 border-b-2 border-red-500 text-red-900 font-semibold rounded-sm px-0.5"
                  : "bg-amber-100 border-b-2 border-amber-500 text-amber-900 font-semibold rounded-sm px-0.5"
              }
            >
              {tok}
            </span>
          );
        })}
      </>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-orange-200 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">🔊 Pronunciation — Sentence Errors</h2>
          <p className="text-white/80 text-xs mt-0.5">Underlined words had pronunciation issues</p>
        </div>
        {hasAudio && (
          <span className="text-white/70 text-xs">▶ buttons seek the audio player below</span>
        )}
      </div>
      <div className="p-6 space-y-4">
        {sentences.map((sent, si) => (
          <div
            key={si}
            className="border-l-4 border-orange-300 pl-4 pr-2 py-2 bg-orange-50 rounded-r-lg"
          >
            <div className="flex justify-between items-start gap-3 mb-3">
              <p className="text-sm text-slate-700 leading-7 flex-1">
                {highlightSentence(sent.sentence, sent.word_errors)}
              </p>
              <button
                onClick={() => playSentence(sent.start_time, sent.end_time)}
                disabled={!hasAudio}
                className="flex-shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                title={hasAudio ? `Play from ${formatTime(sent.start_time)}` : "No audio available"}
              >
                ▶ {formatTime(sent.start_time)}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sent.word_errors.map((w, wi) => (
                <div
                  key={wi}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                    w.score < 40
                      ? "bg-white border-red-200"
                      : "bg-white border-amber-200"
                  }`}
                >
                  <span className={`font-bold ${w.score < 40 ? "text-red-700" : "text-amber-700"}`}>
                    {w.word}
                  </span>
                  <span className="font-mono text-slate-500">/{w.reference_ipa}/</span>
                  <span className="text-slate-600">→ {w.fix_hint}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
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
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-xl font-semibold text-red-700">⚠️ {loadError}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-xl font-semibold text-slate-800">Không tìm thấy kết quả</p>
        </div>
      </div>
    );
  }

  const bd: SpeakingGradingBreakdown | undefined = result.grading_breakdown;
  const overallScore = bd?.overall_band ?? result.score;
  const colors = overallScore != null ? bandColor(overallScore) : null;
  const degraded = new Set(bd?.metadata?.degraded_features ?? []);
  const sentenceErrors = bd?.rubrics?.P?.sentence_errors ?? [];
  const hasAudio = !!result.audio_url;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-1.5 rounded-full text-xs font-bold mb-4 tracking-wide">
            KẾT QUẢ BÀI THI NÓI IELTS
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-1">Kết Quả Bài Thi</h1>
          <p className="text-slate-500 text-sm">Đánh giá chi tiết kỹ năng Speaking của bạn</p>
        </div>

        {/* ── PENDING ── */}
        {(result.status === "pending" || overallScore == null) && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-sm">
              ⏳ Đang chấm điểm — tải lại trang sau ít phút
            </div>
          </div>
        )}

        {/* ── FAILED ── */}
        {result.status === "failed" && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 p-8">
            <p className="text-red-700 font-semibold">❌ Chấm điểm thất bại</p>
            {result.feedback && <p className="text-sm text-slate-600 mt-2">{result.feedback}</p>}
          </div>
        )}

        {/* ── GRADED ── */}
        {result.status === "graded" && overallScore != null && (
          <>
            {/* Section 1: Overall score */}
            <div className={`bg-gradient-to-br ${colors!.bg} rounded-2xl shadow-sm p-8 text-center border-2 ${colors!.border}`}>
              <p className="text-sm font-semibold text-slate-600 mb-3">Overall Band Score</p>
              <div
                className={`relative inline-flex items-center justify-center w-28 h-28 rounded-full bg-white border-4 ${colors!.border} shadow-lg`}
              >
                <span className={`text-4xl font-black ${colors!.text}`}>{overallScore}</span>
              </div>
              <p className={`mt-4 text-sm font-medium ${colors!.text}`}>{bandLabel(overallScore)}</p>
            </div>

            {/* Section 2: Rubric grid */}
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

            {/* Section 2 fallback: legacy plain feedback */}
            {!bd && result.feedback && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
                  <h2 className="text-lg font-bold text-white">📝 Nhận Xét Chi Tiết</h2>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed text-sm">{result.feedback}</p>
                </div>
              </div>
            )}

            {/* Section 3: Pronunciation sentence highlights */}
            {sentenceErrors.length > 0 && (
              <PronunciationSection
                sentences={sentenceErrors}
                audioRef={audioRef}
                hasAudio={hasAudio}
              />
            )}

            {/* Section 4: Transcripts */}
            {result.transcripts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-800 px-6 py-4">
                  <h2 className="text-lg font-bold text-white">📝 Bài nói (Transcript)</h2>
                </div>
                <div className="p-6">
                  <div className="flex gap-2 mb-4">
                    {result.transcripts.map((t) => (
                      <button
                        key={t.part_number}
                        onClick={() => setActiveTranscriptPart(t.part_number)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          activeTranscriptPart === t.part_number
                            ? "bg-orange-500 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Part {t.part_number}
                      </button>
                    ))}
                  </div>
                  {result.transcripts
                    .filter((t) => t.part_number === activeTranscriptPart)
                    .map((t) => (
                      <div key={t.part_number} className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {t.text}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Section 5: Audio player */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
                <h2 className="text-lg font-bold text-white">🎧 Bài nói bạn đã nộp</h2>
                <p className="text-white/70 text-xs mt-0.5">Nhấn ▶ trên từng câu ở trên để nghe đoạn đó</p>
              </div>
              <div className="p-6">
                {hasAudio ? (
                  <audio
                    ref={audioRef}
                    controls
                    src={result.audio_url}
                    className="w-full"
                  />
                ) : (
                  <p className="text-slate-500 text-sm">Không tìm thấy audio để phát.</p>
                )}
              </div>
            </div>

            {/* Section 6: Assignment questions */}
            {assignment && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
                  <h2 className="text-lg font-bold text-white">📋 Đề bài</h2>
                  <p className="text-white/70 text-xs mt-0.5">Câu hỏi Speaking Parts 1–3</p>
                </div>
                <div className="p-6 space-y-5">
                  {assignment.parts?.map((part) => (
                    <div key={part.part_number}>
                      <h3 className="font-semibold text-slate-800 mb-2">Phần {part.part_number}</h3>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 prose prose-sm max-w-none text-slate-700">
                        <ReactMarkdown>{part.question}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center pb-4">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-6 py-2.5 shadow-sm border border-slate-200">
            <span className="text-xs text-slate-500">
              💡 IELTS Speaking: Fluency &amp; Coherence · Lexical Resource · Grammar · Pronunciation
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
