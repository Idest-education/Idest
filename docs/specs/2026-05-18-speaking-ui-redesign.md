# Speaking Test UI Redesign

**Date:** 2026-05-18  
**Scope:** Three frontend pages wired to the new speaking grading pipeline  
**Approach:** Direct page updates (Approach A) — minimal blast radius, no new abstractions

---

## Background

The new speaking pipeline (`apps/ai/ielts_ai/speaking_scorer/`) scores submissions via RabbitMQ and writes a rich `grading_breakdown` object to MongoDB alongside the existing `score`, `feedback`, and `transcripts` fields. The `GET /speaking/responses/:id` endpoint already returns this data — the frontend was never updated to display it.

The `grading_breakdown` shape:
```ts
{
  overall_band: number
  rubrics: {
    FC: RubricScore  // Fluency & Coherence
    LR: RubricScore  // Lexical Resource
    GR: RubricScore  // Grammar Range & Accuracy
    P:  RubricScore  // Pronunciation — also has sentence_errors
  }
  metadata: { degraded_features?: string[] }
}

interface RubricScore {
  band: number
  feedback: string
  feature_evidence: Record<string, number>
  sentence_errors?: SentenceError[]   // P rubric only
}

interface SentenceError {
  sentence: string
  start_time: number   // seconds into the combined audio
  end_time: number
  word_errors: WordError[]
}

interface WordError {
  word: string
  score: number                        // 0–100, lower = worse
  reference_ipa: string
  problematic_phones: { phone: string; score: number }[]
  fix_hint: string
}
```

---

## Pages in Scope

### 1. Result page — `app/(protected)/assignment/speaking/[id]/result/[submissionId]/page.tsx`

**What changes:** Full redesign of the result layout to display `grading_breakdown`. No API or backend changes needed.

**Layout (top to bottom, single scrollable column):**

**Section 1 — Overall band score**  
Centered circle badge showing `grading_breakdown.overall_band` (falls back to `result.score`). Color-coded by band (≥8 green, ≥6.5 blue, ≥5 yellow, <5 red). Band descriptor beneath (Xuất sắc / Tốt / Khá / Cần cải thiện).

**Section 2 — 2×2 rubric grid**  
Four cards: FC (blue), LR (green), GR (purple), P (orange). Each card shows:
- Rubric label + sub-label (e.g. "Speaking rate · rhythm · discourse markers")
- Band score (large, right-aligned)
- Feedback text (one sentence from `rubric.feedback`)
- Feature evidence as labeled progress bars (normalized 0–100 where values are percentages; shown as raw numbers where they are ratios or counts)
- If `metadata.degraded_features` includes the rubric key, show a small "⚠ heuristic" badge

**Section 3 — Pronunciation sentence highlights** (only rendered when `rubrics.P.sentence_errors` is non-empty)  
Each sentence is a left-bordered block containing:
- The full sentence text with each `word_error.word` underlined and highlighted (amber if score 40–59, red if score <40)
- An orange **▶ M:SS** play button (right-aligned) showing `Math.floor(start_time/60):String(start_time%60).padStart(2,'0')`
- Below the sentence: one pill per `word_error` showing `word · /ipa/ → fix_hint`

Clicking the play button sets `audioRef.current.currentTime = start_time`, calls `audioRef.current.play()`, and registers a `timeupdate` listener that pauses at `end_time`. The ref is shared with Section 5.

**Section 4 — Transcript** (only rendered when `result.transcripts.length > 0`)  
Tab row (Part 1 / Part 2 / Part 3). Active tab shows its transcript text in a `bg-gray-50` box.

**Section 5 — Audio player**  
`<audio ref={audioRef} controls src={result.audio_url} />` — single shared player. The play buttons in Section 3 seek this element. Rendered even when `audio_url` is empty (with a "no audio" message).

**Section 6 — Assignment questions**  
Unchanged from current implementation: parts 1–3 question text rendered with ReactMarkdown.

**When `grading_breakdown` is absent** (older submissions graded by the previous pipeline): show the current layout — overall score + plain `feedback` text only. This ensures backwards compatibility with existing graded submissions.

**When `status === "pending"`:** unchanged — show "Đang chấm điểm" state.

**When `status === "failed"`:** show error message from `result.feedback`.

---

### 2. Free practice page — `app/(protected)/ai/speaking/page.tsx`

**What changes:** Replace the current placeholder with a functional page.

**Layout:** Centered single-column. Icon (🎙️), heading "Luyện nói IELTS", one-line description, a primary "▶ Bắt đầu ngẫu nhiên" button, and three info cards (3 phần thi / Chấm điểm tự động / Kết quả chi tiết).

**Behaviour:** The button triggers a server action that:
1. Calls `GET /speaking/assignments?page=1&limit=100` with the user's JWT
2. Picks a random assignment from the returned list
3. Redirects to `/assignment/speaking/[id]`

Loading state: button shows a spinner while the action is in flight (use `useTransition` or `useFormStatus`). If the API returns an empty list, show a toast/alert "Không có đề thi nào".

The page is a Client Component (needs `useState` for loading state). The server action lives in the same file or a co-located `actions.ts`.

---

### 3. Test-taking page — `app/(protected)/assignment/speaking/[id]/page.tsx`

**What changes:** Minor — the recording/submission flow is already compatible with the new pipeline. Two targeted fixes:

1. **`user_id` source:** the page currently reads `localStorage.getItem("user_id")`. Change this to read from the Supabase client session (`supabase.auth.getSession()`) so it works in contexts where `user_id` was never written to localStorage (e.g. fresh sessions from the practice redirect).

2. **Post-submit redirect:** after a successful `submitSpeaking()` call, the response returns the new submission object with its `id`. Redirect to `/assignment/speaking/[id]/result/[submissionId]` directly instead of going through `/assignment/submissions`. This gives the user immediate feedback.

No layout changes to the test-taking page.

---

## Type Changes — `types/assignment.ts`

Add to the existing `SpeakingSubmissionResult` interface:

```ts
grading_breakdown?: SpeakingGradingBreakdown

interface ProblematicPhone {
  phone: string
  score: number
}

interface WordError {
  word: string
  score: number
  reference_ipa: string
  problematic_phones: ProblematicPhone[]
  fix_hint: string
}

interface SentenceError {
  sentence: string
  start_time: number
  end_time: number
  word_errors: WordError[]
}

interface RubricScore {
  band: number
  feedback: string
  feature_evidence: Record<string, number>
  sentence_errors?: SentenceError[]
}

interface SpeakingGradingBreakdown {
  overall_band: number
  rubrics: {
    FC: RubricScore
    LR: RubricScore
    GR: RubricScore
    P: RubricScore
  }
  metadata: {
    degraded_features?: string[]
  }
}
```

No changes to `assignment.service.ts` — `getSpeakingSubmissionResult` already returns the full response; the result page casts via `(sRes as any)?.data ?? sRes` which passes through `grading_breakdown` unchanged.

---

## Data Flow

```
User lands on /ai/speaking
  → clicks "Bắt đầu ngẫu nhiên"
  → server action: GET /speaking/assignments (random pick)
  → redirect to /assignment/speaking/[id]

User records Parts 1–3, clicks Submit
  → POST /speaking/responses (multipart, 3 audio files)
  → assignments service uploads combined audio to Supabase, queues to RabbitMQ
  → redirect to /assignment/speaking/[id]/result/[submissionId]

Result page loads
  → GET /speaking/assignments/[id]          (for question text)
  → GET /speaking/responses/[submissionId]  (score + grading_breakdown)
  → if status === "pending": show spinner (no polling — user refreshes manually)
  → if status === "graded": render full result layout
  → if status === "failed": show error message
```

---

## Error Handling

- **`grading_breakdown` absent:** fall back to legacy layout (score + feedback text). No crash.
- **`audio_url` empty:** audio player renders with a "no audio" message; play buttons in pronunciation section are disabled.
- **`sentence_errors` empty or absent:** skip Section 3 entirely.
- **Random assignment fetch fails:** show inline error on practice page, button re-enabled.
- **`user_id` missing from session:** `submitSpeaking` call fails with 400 from the backend; show alert to user.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/website/types/assignment.ts` | Add `SpeakingGradingBreakdown` and sub-types; extend `SpeakingSubmissionResult` |
| `apps/website/app/(protected)/assignment/speaking/[id]/result/[submissionId]/page.tsx` | Full rewrite — new layout with rubric grid, pronunciation highlights, shared audio ref |
| `apps/website/app/(protected)/ai/speaking/page.tsx` | Replace placeholder with random-test landing page |
| `apps/website/app/(protected)/assignment/speaking/[id]/page.tsx` | Fix `user_id` source; fix post-submit redirect |

No backend changes. No new component files. No new service files.
