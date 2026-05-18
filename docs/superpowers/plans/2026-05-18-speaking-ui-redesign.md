# Speaking Test UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the three speaking pages (free practice, test-taking, result) to the new grading pipeline that returns per-rubric bands, feature metrics, and per-word pronunciation errors.

**Architecture:** Direct updates to four files — types first, then test-taking page fixes, then practice page, then result page rewrite. No new component files, no backend changes. The result page holds a single `audioRef` shared between the audio player and the pronunciation sentence play buttons; clicking a sentence play button seeks the ref's `currentTime` and registers a `timeupdate` listener to auto-stop at `end_time`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Supabase client (`@/lib/supabase/client`), `@/services/assignment.service`, ReactMarkdown

---

## File Map

| File | Role |
|------|------|
| `apps/website/types/assignment.ts` | Add `SpeakingGradingBreakdown` types; extend `SpeakingSubmissionResult` |
| `apps/website/app/(protected)/assignment/speaking/[id]/page.tsx` | Fix `user_id` source; fix post-submit redirect to result page |
| `apps/website/app/(protected)/ai/speaking/page.tsx` | Replace placeholder with random-test landing page |
| `apps/website/app/(protected)/assignment/speaking/[id]/result/[submissionId]/page.tsx` | Full result page rewrite with rubric grid + pronunciation highlights |

---

## Task 1: Add `SpeakingGradingBreakdown` types

**Files:**
- Modify: `apps/website/types/assignment.ts` (around line 396 — the `SpeakingSubmissionResult` interface)

- [ ] **Step 1: Add the new interfaces before `SpeakingSubmissionResult`**

Open `apps/website/types/assignment.ts`. Find the `SpeakingSubmissionResult` interface (currently around line 396). Insert these interfaces immediately **before** it:

```ts
export interface ProblematicPhone {
  phone: string;
  score: number;
}

export interface WordError {
  word: string;
  score: number;
  reference_ipa: string;
  problematic_phones: ProblematicPhone[];
  fix_hint: string;
}

export interface SentenceError {
  sentence: string;
  start_time: number;
  end_time: number;
  word_errors: WordError[];
}

export interface RubricScore {
  band: number;
  feedback: string;
  feature_evidence: Record<string, number>;
  sentence_errors?: SentenceError[];
}

export interface SpeakingGradingBreakdown {
  overall_band: number;
  rubrics: {
    FC: RubricScore;
    LR: RubricScore;
    GR: RubricScore;
    P: RubricScore;
  };
  metadata: {
    degraded_features?: string[];
  };
}
```

- [ ] **Step 2: Extend `SpeakingSubmissionResult` with `grading_breakdown`**

Find the `SpeakingSubmissionResult` interface and add one field:

```ts
export interface SpeakingSubmissionResult {
  id?: string;
  _id?: string;
  assignment_id: string;
  user_id: string;
  audio_url?: string;
  score?: number;
  feedback?: string;
  status: "pending" | "graded" | "failed";
  transcripts: {
    part_number: number;
    text: string;
  }[];
  created_at?: string;
  grading_breakdown?: SpeakingGradingBreakdown;   // ← add this line
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/website && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new interfaces. (Existing errors unrelated to this task are fine to ignore.)

- [ ] **Step 4: Commit**

```bash
git add apps/website/types/assignment.ts
git commit -m "feat(types): add SpeakingGradingBreakdown types for new speaking pipeline"
```

---

## Task 2: Fix test-taking page — `user_id` source and post-submit redirect

**Files:**
- Modify: `apps/website/app/(protected)/assignment/speaking/[id]/page.tsx`

The current page reads `localStorage.getItem("user_id")` and redirects to `/assignment/submissions` after submit. We need it to read from the Supabase session and redirect to the result page.

- [ ] **Step 1: Add Supabase client import**

At the top of the file, add:

```ts
import { createClient } from "@/lib/supabase/client";
```

- [ ] **Step 2: Replace `handleSubmit` with the fixed version**

Find the `handleSubmit` function and replace it entirely:

```ts
async function handleSubmit() {
  if (!assignment || !audio1 || !audio2 || !audio3) {
    alert("Vui lòng ghi âm hoặc tải lên đầy đủ 3 bản ghi âm (phần 1, 2, 3).");
    return;
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? localStorage.getItem("user_id");

  if (!userId) {
    alert("Không thể xác định người dùng. Vui lòng đăng nhập lại.");
    return;
  }

  setSubmitting(true);

  const res = await submitSpeaking(
    {
      assignment_id: assignment.id,
      user_id: userId,
    },
    {
      audioOne: audio1,
      audioTwo: audio2,
      audioThree: audio3,
    }
  );

  const submissionId = res?.data?._id ?? res?.data?.id ?? res?._id ?? res?.id;

  if (submissionId) {
    router.push(`/assignment/speaking/${id}/result/${submissionId}`);
  } else {
    // fallback if id not in response
    try { sessionStorage.setItem("assignment_grading_queued", "1"); } catch {}
    router.push("/assignment/submissions");
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/website && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/website/app/(protected)/assignment/speaking/[id]/page.tsx"
git commit -m "fix(speaking): read user_id from Supabase session and redirect to result page after submit"
```

---

## Task 3: Free practice page — random test landing

**Files:**
- Modify: `apps/website/app/(protected)/ai/speaking/page.tsx`

Replace the current two-line placeholder entirely.

- [ ] **Step 1: Write the new practice page**

Replace the entire file contents with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { http } from "@/services/http";

function getAssignmentBaseUrl() {
  return "http://localhost:8008";
}

export default function SpeakingPracticePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startRandomTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await http.get(`${getAssignmentBaseUrl()}/speaking/assignments`, {
        params: { page: 1, limit: 100 },
      });
      const list: any[] = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
      if (!list.length) {
        setError("Không có đề thi nào.");
        return;
      }
      const pick = list[Math.floor(Math.random() * list.length)];
      const assignmentId = pick._id ?? pick.id;
      router.push(`/assignment/speaking/${assignmentId}`);
    } catch {
      setError("Không thể tải đề thi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg">
          🎙️
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900 mb-3">Luyện nói IELTS</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Bắt đầu một bài thi Speaking ngẫu nhiên. Ghi âm 3 phần, nộp bài và nhận kết quả chi tiết ngay.
        </p>

        {/* Start button */}
        <button
          onClick={startRandomTest}
          disabled={loading}
          className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-60 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 text-base"
        >
          {loading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang tải đề thi…
            </>
          ) : (
            <>▶ &nbsp;Bắt đầu ngẫu nhiên</>
          )}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 inline-block">
            {error}
          </p>
        )}

        <div className="mt-10 text-xs text-slate-400">Chọn ngẫu nhiên từ các đề thi · Kết quả sau ~1 phút</div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: "🎤", title: "3 phần thi", desc: "Ghi âm từng phần theo đề bài" },
            { icon: "🤖", title: "Chấm điểm tự động", desc: "FC · LR · GR · Pronunciation" },
            { icon: "📊", title: "Kết quả chi tiết", desc: "Lỗi phát âm từng câu + gợi ý" },
          ].map((card) => (
            <div key={card.title} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 text-left">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="text-xs font-bold text-slate-800 mb-1">{card.title}</div>
              <div className="text-xs text-slate-500">{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/website && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Smoke-test in browser**

Navigate to `http://localhost:3000/ai/speaking`. You should see the landing page with the gradient icon, heading, start button, and three info cards. Click the button — it should show a spinner and then redirect to `/assignment/speaking/[some-id]`.

- [ ] **Step 4: Commit**

```bash
git add "apps/website/app/(protected)/ai/speaking/page.tsx"
git commit -m "feat(speaking): add random test landing page at /ai/speaking"
```

---

## Task 4: Result page — full rewrite

**Files:**
- Modify: `apps/website/app/(protected)/assignment/speaking/[id]/result/[submissionId]/page.tsx`

This is the largest task. Replace the file completely with the new layout: overall score → 2×2 rubric grid → pronunciation sentence highlights (with seek-to-play) → transcripts → audio player → assignment questions.

- [ ] **Step 1: Write the new result page**

Replace the entire file:

```tsx
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

// Normalize a feature_evidence value to 0–100 for the progress bar.
// Values already 0–100 (percentages) pass through; small decimals (ratios) are
// multiplied by 100; integer counts are capped at 100.
function normalizeEvidence(key: string, value: number): number {
  if (value > 1) return Math.min(value, 100);   // already a percentage or count
  return Math.round(value * 100);               // ratio 0–1 → percentage
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

  function playSentence(startTime: number, endTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    stopAtRef.current = endTime;
    audio.currentTime = startTime;
    audio.play();
    const onTimeUpdate = () => {
      if (stopAtRef.current !== null && audio.currentTime >= stopAtRef.current) {
        audio.pause();
        stopAtRef.current = null;
        audio.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
  }

  function highlightSentence(sentence: string, errors: SentenceError["word_errors"]) {
    if (!errors.length) return <span>{sentence}</span>;

    // Build a map of lowercased word → highest severity for styling
    const wordSeverity = new Map<string, "red" | "amber">();
    for (const e of errors) {
      const w = e.word.toLowerCase();
      const severity = e.score < 40 ? "red" : "amber";
      if (!wordSeverity.has(w) || (severity === "red" && wordSeverity.get(w) === "amber")) {
        wordSeverity.set(w, severity);
      }
    }

    // Split sentence into tokens, preserving punctuation spacing
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
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, submissionId]);

  if (loading) return <LoadingScreen />;

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-block bg-gradient-to-r from-blue-600 to-violet-600 text-white px-6 py-1.5 rounded-full text-xs font-bold mb-4 tracking-wide">
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

        {/* ── FAILED (no grading_breakdown) ── */}
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

            {/* Section 2: Rubric grid — only when grading_breakdown present */}
            {bd && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["FC", "LR", "GR", "P"] as const).map((key) => (
                  <RubricCard
                    key={key}
                    rubricKey={key}
                    rubric={bd.rubrics[key]}
                    degraded={degraded.has(key.toLowerCase()) || degraded.has(`ollama_${key.toLowerCase()}_gr`) || degraded.has("ollama_lr_gr")}
                  />
                ))}
              </div>
            )}

            {/* Section 2 fallback: legacy plain feedback when no grading_breakdown */}
            {!bd && result.feedback && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4">
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
                            ? "bg-blue-600 text-white"
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
                <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4">
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/website && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors. (Note: `audioRef` is typed as `RefObject<HTMLAudioElement | null>` — this is correct for React 19.)

- [ ] **Step 3: Smoke-test the pending state**

Open a submission that is still pending (or temporarily change a submission's status in MongoDB to "pending"):
- Navigate to `http://localhost:3000/assignment/speaking/[id]/result/[submissionId]`
- Expected: shows the amber "Đang chấm điểm" banner

- [ ] **Step 4: Smoke-test the graded state with grading_breakdown**

Use the known graded submission: `http://localhost:3000/assignment/speaking/e517d533-8599-40b1-b880-932edde1ce85/result/1c513bd4-f33a-4eef-ad52-0be806478e9d`

Expected:
- Overall band `6.5` in a colored circle
- 4 rubric cards (FC 6.5, LR 3.5, GR 8.5, P 7.0) with progress bars
- LR and GR cards show "⚠ heuristic" badge (degraded_features includes "ollama_lr_gr")
- Pronunciation section with orange-bordered sentences, underlined words, fix hints
- Each sentence has a ▶ button with a timestamp
- Audio player renders (clicking ▶ on a sentence seeks the player)

- [ ] **Step 5: Smoke-test the legacy fallback (no grading_breakdown)**

Use the graded submission with only `score` + `feedback` (no grading_breakdown): `http://localhost:3000/assignment/speaking/e517d533-8599-40b1-b880-932edde1ce85/result/d0f7ddfd-a3a9-4745-98af-e2ae76adb682`

Expected: overall score circle + plain feedback text card. No rubric grid, no pronunciation section.

- [ ] **Step 6: Commit**

```bash
git add "apps/website/app/(protected)/assignment/speaking/[id]/result/[submissionId]/page.tsx"
git commit -m "feat(speaking): redesign result page with rubric grid and pronunciation highlights"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Add `SpeakingGradingBreakdown` types | Task 1 |
| Extend `SpeakingSubmissionResult` | Task 1 |
| Fix `user_id` from Supabase session | Task 2 |
| Post-submit redirect to result page | Task 2 |
| Random test practice page | Task 3 |
| Error state for empty assignment list | Task 3 |
| Overall band score (colored circle) | Task 4 |
| 2×2 rubric grid with evidence bars | Task 4 |
| Degraded heuristic badge | Task 4 |
| Pronunciation sentence highlights | Task 4 |
| ▶ play button with timestamp seek | Task 4 |
| Shared `audioRef` between Section 3 and 5 | Task 4 |
| Transcript tab per part | Task 4 |
| Audio player Section 5 | Task 4 |
| Backwards-compat fallback (no `grading_breakdown`) | Task 4 |
| Assignment questions Section 6 | Task 4 |
| `audio_url` empty → disable play buttons | Task 4 (`disabled={!hasAudio}`) |
| `sentence_errors` absent → skip Section 3 | Task 4 (`sentenceErrors.length > 0`) |

**Placeholder scan:** No TBDs or incomplete steps. All code is complete.

**Type consistency:** `SpeakingGradingBreakdown`, `RubricScore`, `SentenceError`, `WordError` defined in Task 1 and imported by name in Task 4. `normalizeEvidence` used in `RubricCard` which is defined in same file. `formatTime` defined before use. ✓
