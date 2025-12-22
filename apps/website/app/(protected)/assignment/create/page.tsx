"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  createListeningAssignment,
  createReadingAssignment,
  createSpeakingAssignment,
  createWritingAssignment,
} from "@/services/assignment.service";
import type { CreateReadingOrListeningAssignmentPayload, CreateSpeakingAssignmentPayload, CreateWritingAssignmentPayload, MediaAssetV2, QuestionV2Authoring } from "@/types/assignment";

type Skill = "reading" | "listening" | "writing" | "speaking";

function uuid() {
  // Browser-safe UUID; Next runs this page on client ("use client")
  return crypto.randomUUID();
}

type QuestionType = "fill_blank" | "multiple_choice" | "matching" | "map_labeling" | "true_false";

type SubquestionForm = {
  id: string;
  subprompt: string;
  optionsText: string; // one option per line
  answerText: string; // parsed to mixed
};

type QuestionForm = {
  id: string;
  type: QuestionType;
  prompt: string;
  subquestions: SubquestionForm[];
};

type SectionForm = {
  id: string;
  title: string;
  material_url?: string;
  reading_document?: string;
  reading_image_url?: string;
  listening_audio_url?: string;
  listening_transcript?: string;
  listening_image_url?: string;
  questions: QuestionForm[];
};

function optionsFromText(text: string): string[] {
  return text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeOptions(type: QuestionType, rawText: string): string[] {
  const opts = optionsFromText(rawText);
  if (type === "true_false") return opts.length ? opts : ["True", "False"];
  // For fill_blank, options are often not used; backend DTO allows empty arrays.
  if (type === "fill_blank") return opts;
  return opts;
}

function parseMixedAnswer(input: string): any {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Try boolean
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;

  // Try number
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber) && String(asNumber) === trimmed) return asNumber;

  // Try JSON (arrays/objects/quoted strings/numbers/bools)
  if (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith('"') ||
    trimmed.startsWith("'")
  ) {
    try {
      // Allow single-quoted string input by normalizing
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1);
      }
      return JSON.parse(trimmed);
    } catch {
      // fallthrough
    }
  }

  return trimmed;
}

function makeMedia(kind: MediaAssetV2["kind"], url: string, meta?: Partial<MediaAssetV2>): MediaAssetV2 {
  return {
    id: uuid(),
    kind,
    url,
    ...(meta || {}),
  };
}

function letterToIndex(letter: string): number | null {
  const c = letter.trim().toUpperCase();
  if (!c) return null;
  const code = c.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  return null;
}

function normalizeTFNG(input: unknown): "TRUE" | "FALSE" | "NOT_GIVEN" | null {
  const v = String(input ?? "").trim().toUpperCase();
  if (v === "TRUE") return "TRUE";
  if (v === "FALSE") return "FALSE";
  if (v === "NOT GIVEN" || v === "NOT_GIVEN" || v === "NG") return "NOT_GIVEN";
  return null;
}

function makeEmptySubquestion(): SubquestionForm {
  return { id: uuid(), subprompt: "", optionsText: "", answerText: "" };
}

function makeEmptyQuestion(): QuestionForm {
  return { id: uuid(), type: "multiple_choice", prompt: "", subquestions: [makeEmptySubquestion()] };
}

function makeEmptySection(skill: Skill): SectionForm {
  if (skill === "reading") {
    return {
      id: uuid(),
      title: "",
      reading_document: "",
      reading_image_url: "",
      questions: [makeEmptyQuestion()],
    };
  }
  if (skill === "listening") {
    return {
      id: uuid(),
      title: "",
      listening_audio_url: "",
      listening_transcript: "",
      listening_image_url: "",
      questions: [makeEmptyQuestion()],
    };
  }
  return { id: uuid(), title: "", questions: [makeEmptyQuestion()] };
}

export default function CreateAssignmentPage() {
  const [skill, setSkill] = useState<Skill>("reading");
  const [assignmentTitle, setAssignmentTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isPublic, setIsPublic] = useState<boolean>(true);

  const [sections, setSections] = useState<SectionForm[]>(() => [makeEmptySection("reading")]);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);

  // Listening helpers (optional) to speed up creation
  const [listeningDefaultAudioUrl, setListeningDefaultAudioUrl] = useState<string>("");
  const [listeningDefaultTranscript, setListeningDefaultTranscript] = useState<string>("");
  const [listeningDefaultImageUrl, setListeningDefaultImageUrl] = useState<string>("");

  const [writing, setWriting] = useState<CreateWritingAssignmentPayload>({
    title: "",
    taskone: "",
    tasktwo: "",
    img: "",
    imgDescription: "",
  });

  const [speakingTitle, setSpeakingTitle] = useState<string>("");
  const [speakingParts, setSpeakingParts] = useState<{ [k in 1 | 2 | 3]: Array<{ prompt: string }> }>({
    1: [{ prompt: "" }],
    2: [{ prompt: "" }],
    3: [{ prompt: "" }],
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const resetForm = () => {
    setError(null);
    setResult(null);
    setAssignmentTitle("");
    setDescription("");
    setIsPublic(true);
    setSections([makeEmptySection(skill)]);
    setActiveSectionIndex(0);
    setListeningDefaultAudioUrl("");
    setListeningDefaultTranscript("");
    setListeningDefaultImageUrl("");
    setWriting({ title: "", taskone: "", tasktwo: "", img: "", imgDescription: "" });
    setSpeakingTitle("");
    setSpeakingParts({ 1: [{ prompt: "" }], 2: [{ prompt: "" }], 3: [{ prompt: "" }] });
  };

  const onSkillChange = (s: Skill) => {
    setSkill(s);
    setError(null);
    setResult(null);
    setAssignmentTitle("");
    setDescription("");
    setIsPublic(true);
    setSections([makeEmptySection(s)]);
    setActiveSectionIndex(0);
    setListeningDefaultAudioUrl("");
    setListeningDefaultTranscript("");
    setListeningDefaultImageUrl("");
    setWriting({ title: "", taskone: "", tasktwo: "", img: "", imgDescription: "" });
    setSpeakingTitle("");
    setSpeakingParts({ 1: [{ prompt: "" }], 2: [{ prompt: "" }], 3: [{ prompt: "" }] });
  };

  const readingListeningPayload = useMemo((): CreateReadingOrListeningAssignmentPayload => {
    const payload: CreateReadingOrListeningAssignmentPayload = {
      skill: skill === "listening" ? "listening" : "reading",
      title: assignmentTitle,
      description: description || undefined,
      is_public: isPublic,
      sections: sections.map((s, idx) => {
        const material =
          skill === "reading"
            ? {
                type: "reading" as const,
                document_md: s.reading_document || "",
                images: s.reading_image_url ? [makeMedia("image", s.reading_image_url)] : [],
              }
            : {
                type: "listening" as const,
                audio: makeMedia("audio", s.listening_audio_url || ""),
                transcript_md: s.listening_transcript || undefined,
                images: s.listening_image_url ? [makeMedia("image", s.listening_image_url)] : [],
              };

        // Flatten legacy questions/subquestions into v2 questions (authoring includes answer_key)
        const v2Questions: QuestionV2Authoring[] = [];
        let order = 1;

        for (const q of s.questions) {
          if (q.type === "fill_blank") {
            const blanks: Record<string, unknown> = {};
            const blankDefs = q.subquestions.map((sq, i) => {
              const blankId = String(i + 1);
              blanks[blankId] = parseMixedAnswer(sq.answerText);
              return { blank_id: blankId, placeholder_label: sq.subprompt || undefined };
            });

            v2Questions.push({
              id: uuid(),
              order_index: order++,
              type: "gap_fill_template",
              prompt_md: q.prompt || undefined,
              stimulus: {
                instructions_md: undefined,
                content_md: q.prompt || undefined,
                template: {
                  format: "text",
                  body: blankDefs.map((b) => `{{blank:${b.blank_id}}}`).join("\n"),
                  blanks: blankDefs,
                },
              },
              interaction: {},
              answer_key: { blanks },
            });
            continue;
          }

          if (q.type === "true_false") {
            for (const sq of q.subquestions) {
              const normalized = normalizeTFNG(parseMixedAnswer(sq.answerText));
              v2Questions.push({
                id: uuid(),
                order_index: order++,
                type: "true_false_not_given",
                prompt_md: q.prompt || undefined,
                stimulus: { content_md: sq.subprompt || "" },
                interaction: {
                  options: [
                    { id: "true", label_md: "TRUE" },
                    { id: "false", label_md: "FALSE" },
                    { id: "not_given", label_md: "NOT GIVEN" },
                  ],
                },
                answer_key: { choice: normalized ?? "NOT_GIVEN" },
              });
            }
            continue;
          }

          if (q.type === "multiple_choice") {
            for (const sq of q.subquestions) {
              const opts = normalizeOptions(q.type, sq.optionsText);
              const options = opts.map((label, i) => ({ id: `opt${i + 1}`, label_md: label }));

              const parsed = parseMixedAnswer(sq.answerText);
              let choiceId: string | null = null;
              if (typeof parsed === "number") {
                choiceId = options[parsed]?.id ?? null;
              } else {
                const idx = letterToIndex(String(parsed));
                if (idx !== null) choiceId = options[idx]?.id ?? null;
                if (!choiceId) {
                  const matchIdx = options.findIndex((o) => String(o.label_md).trim() === String(parsed).trim());
                  if (matchIdx >= 0) choiceId = options[matchIdx].id;
                }
              }

              v2Questions.push({
                id: uuid(),
                order_index: order++,
                type: "multiple_choice_single",
                prompt_md: q.prompt || undefined,
                stimulus: { content_md: sq.subprompt || "" },
                interaction: { options },
                answer_key: { choice: choiceId ?? "" },
              });
            }
            continue;
          }

          if (q.type === "matching") {
            const rightLabels = Array.from(
              new Set(q.subquestions.flatMap((sq) => normalizeOptions(q.type, sq.optionsText))),
            );
            const right = rightLabels.map((label, i) => ({ id: `r${i + 1}`, label_md: label }));
            const left = q.subquestions.map((sq) => ({ id: sq.id, label_md: sq.subprompt || sq.id }));

            const map: Record<string, string> = {};
            for (const sq of q.subquestions) {
              const ans = String(parseMixedAnswer(sq.answerText) ?? "").trim();
              const rightIdx = right.findIndex((r) => String(r.label_md).trim().toLowerCase() === ans.toLowerCase());
              map[sq.id] = rightIdx >= 0 ? right[rightIdx].id : "";
            }

            v2Questions.push({
              id: uuid(),
              order_index: order++,
              type: "matching",
              prompt_md: q.prompt || undefined,
              stimulus: { content_md: q.prompt || "" },
              interaction: { left, right },
              answer_key: { map },
            });
            continue;
          }

          if (q.type === "map_labeling") {
            // Not implemented in this builder yet (schema supports it, but editor UX needs special handling).
            // We keep it explicit so teachers don't unknowingly publish an ungradable question.
            throw new Error('map_labeling is not supported in the v2 builder yet. Please use matching/gap fill for now.');
          }
        }

        return {
          id: s.id,
          title: s.title,
          order_index: idx + 1,
          material,
          question_groups: [
            {
              id: uuid(),
              order_index: 1,
              title: undefined,
              instructions_md: undefined,
              questions: v2Questions,
            },
          ],
        };
      }),
    };
    return payload;
  }, [assignmentTitle, description, isPublic, sections, skill]);

  const speakingPayload = useMemo((): CreateSpeakingAssignmentPayload => {
    return {
      title: speakingTitle,
      parts: ([1, 2, 3] as const).map((partNo) => ({
        part_number: partNo,
        questions: (speakingParts[partNo] || [])
          .filter((q) => q.prompt.trim())
          .map((q, idx) => ({ prompt: q.prompt, order_index: idx + 1 })),
      })),
    };
  }, [speakingParts, speakingTitle]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      let res: any;
      if (skill === "reading") res = await createReadingAssignment(readingListeningPayload);
      else if (skill === "listening") res = await createListeningAssignment(readingListeningPayload);
      else if (skill === "writing") res = await createWritingAssignment(writing);
      else res = await createSpeakingAssignment(speakingPayload);

      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tạo bài tập");
    } finally {
      setSubmitting(false);
    }
  };

  const createdId =
    result?.data?.data?._id ||
    result?.data?.data?.id ||
    result?.data?._id ||
    result?.data?.id ||
    result?.data?.data?.submissionId ||
    null;

  return (
    <div className="w-full px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tạo bài tập</h1>
          <p className="text-gray-600 mt-1">Tạo bài tập bằng biểu mẫu (không cần JSON).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/assignment">Quay lại</Link>
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <Tabs value={skill} onValueChange={(v) => onSkillChange(v as Skill)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="reading">Đọc</TabsTrigger>
              <TabsTrigger value="listening">Nghe</TabsTrigger>
              <TabsTrigger value="writing">Viết</TabsTrigger>
              <TabsTrigger value="speaking">Nói</TabsTrigger>
            </TabsList>

            <TabsContent value={skill} className="mt-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Tiêu đề</label>
                    <Input
                      value={skill === "writing" ? writing.title : skill === "speaking" ? speakingTitle : assignmentTitle}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (skill === "writing") setWriting((p) => ({ ...p, title: v }));
                        else if (skill === "speaking") setSpeakingTitle(v);
                        else setAssignmentTitle(v);
                      }}
                      placeholder="Tiêu đề bài tập"
                    />
                  </div>

                  {(skill === "reading" || skill === "listening") && (
                    <div className="flex items-center gap-2 pt-6">
                      <label className="text-sm font-medium text-gray-700">Công khai</label>
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Đặt lại
                  </Button>
                  <Button type="button" onClick={submit} disabled={submitting}>
                    {submitting ? "Đang tạo..." : "Tạo"}
                  </Button>
                </div>
              </div>

              {(skill === "reading" || skill === "listening") && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Mô tả (tùy chọn)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2 w-full min-h-[90px] p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Mô tả ngắn..."
                  />
                </div>
              )}

              {(skill === "reading" || skill === "listening") && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">Trình tạo</div>
                        <div className="text-sm text-gray-600">Trái: đoạn văn/âm thanh. Phải: câu hỏi.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {skill === "listening" && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setSections(() => {
                                const next = [0, 1, 2, 3].map(() => makeEmptySection("listening"));
                                return next;
                              });
                              setActiveSectionIndex(0);
                            }}
                          >
                            Tạo 4 phần
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSections((prev) => {
                              const next = [...prev, makeEmptySection(skill)];
                              return next;
                            });
                            setActiveSectionIndex(sections.length);
                          }}
                        >
                          + Thêm phần
                        </Button>
                      </div>
                    </div>

                    {/* Section selector */}
                    <div className="flex flex-wrap gap-2">
                      {sections.map((s, idx) => (
                        <Button
                          key={s.id}
                          type="button"
                          variant={idx === activeSectionIndex ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveSectionIndex(idx)}
                        >
                          Phần {idx + 1}
                        </Button>
                      ))}
                    </div>

                    {/* Two-pane layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: passage/audio */}
                      <Card className="p-4">
                        {sections[activeSectionIndex] ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-gray-900">Phần {activeSectionIndex + 1}</div>
                              <Button
                                type="button"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                disabled={sections.length === 1}
                                onClick={() => {
                                  setSections((prev) => {
                                    const next = prev.filter((_, i) => i !== activeSectionIndex);
                                    const nextIndex = Math.max(0, Math.min(activeSectionIndex, next.length - 1));
                                    setActiveSectionIndex(nextIndex);
                                    return next.length ? next : [makeEmptySection(skill)];
                                  });
                                }}
                              >
                                Xóa phần
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-sm font-medium text-gray-700">Tiêu đề phần</label>
                                <Input
                                  value={sections[activeSectionIndex].title}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setSections((prev) =>
                                      prev.map((s, i) => (i === activeSectionIndex ? { ...s, title: v } : s)),
                                    );
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700">URL tài liệu (tùy chọn)</label>
                                <Input
                                  value={sections[activeSectionIndex].material_url ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setSections((prev) =>
                                      prev.map((s, i) =>
                                        i === activeSectionIndex ? { ...s, material_url: v } : s,
                                      ),
                                    );
                                  }}
                                />
                              </div>
                            </div>

                            {skill === "reading" ? (
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Đoạn văn đọc</label>
                                <textarea
                                  value={sections[activeSectionIndex].reading_document ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setSections((prev) =>
                                      prev.map((s, i) =>
                                        i === activeSectionIndex ? { ...s, reading_document: v } : s,
                                      ),
                                    );
                                  }}
                                  className="w-full min-h-[280px] p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                  placeholder="Dán đoạn văn đọc vào đây..."
                                />
                                <div>
                                  <label className="text-sm font-medium text-gray-700">URL hình ảnh (tùy chọn)</label>
                                  <Input
                                    value={sections[activeSectionIndex].reading_image_url ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setSections((prev) =>
                                        prev.map((s, i) =>
                                          i === activeSectionIndex ? { ...s, reading_image_url: v } : s,
                                        ),
                                      );
                                    }}
                                    placeholder="https://..."
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {/* Listening quick helpers */}
                                <Card className="p-3 bg-gray-50">
                                  <div className="font-medium text-gray-900 mb-2">Công cụ hỗ trợ nghe</div>
                                  <div className="space-y-2">
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">URL âm thanh mặc định</label>
                                      <Input
                                        value={listeningDefaultAudioUrl}
                                        onChange={(e) => setListeningDefaultAudioUrl(e.target.value)}
                                        placeholder="https://.../audio.mp3"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">Bản ghi mặc định</label>
                                      <textarea
                                        value={listeningDefaultTranscript}
                                        onChange={(e) => setListeningDefaultTranscript(e.target.value)}
                                        className="mt-2 w-full min-h-[90px] p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="Bản ghi..."
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-700">URL hình ảnh mặc định</label>
                                      <Input
                                        value={listeningDefaultImageUrl}
                                        onChange={(e) => setListeningDefaultImageUrl(e.target.value)}
                                        placeholder="https://..."
                                      />
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setSections((prev) =>
                                            prev.map((s, i) =>
                                              i === activeSectionIndex
                                                ? {
                                                    ...s,
                                                    listening_audio_url: listeningDefaultAudioUrl,
                                                    listening_transcript: listeningDefaultTranscript,
                                                    listening_image_url: listeningDefaultImageUrl,
                                                  }
                                                : s,
                                            ),
                                          );
                                        }}
                                      >
                                        Áp dụng cho phần này
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setSections((prev) =>
                                            prev.map((s) => ({
                                              ...s,
                                              listening_audio_url: listeningDefaultAudioUrl,
                                              listening_transcript: listeningDefaultTranscript,
                                              listening_image_url: listeningDefaultImageUrl,
                                            })),
                                          );
                                        }}
                                      >
                                        Áp dụng cho tất cả phần
                                      </Button>
                                    </div>
                                  </div>
                                </Card>

                                <div>
                                  <label className="text-sm font-medium text-gray-700">URL âm thanh</label>
                                  <Input
                                    value={sections[activeSectionIndex].listening_audio_url ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setSections((prev) =>
                                        prev.map((s, i) =>
                                          i === activeSectionIndex ? { ...s, listening_audio_url: v } : s,
                                        ),
                                      );
                                    }}
                                    placeholder="https://.../audio.mp3"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Bản ghi (tùy chọn)</label>
                                  <textarea
                                    value={sections[activeSectionIndex].listening_transcript ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setSections((prev) =>
                                        prev.map((s, i) =>
                                          i === activeSectionIndex ? { ...s, listening_transcript: v } : s,
                                        ),
                                      );
                                    }}
                                    className="mt-2 w-full min-h-[140px] p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="Bản ghi..."
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">URL hình ảnh (tùy chọn)</label>
                                  <Input
                                    value={sections[activeSectionIndex].listening_image_url ?? ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setSections((prev) =>
                                        prev.map((s, i) =>
                                          i === activeSectionIndex ? { ...s, listening_image_url: v } : s,
                                        ),
                                      );
                                    }}
                                    placeholder="https://..."
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">Chưa chọn phần nào.</div>
                        )}
                      </Card>

                      {/* Right: questions */}
                      <Card className="p-4">
                        {sections[activeSectionIndex] ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-gray-900">Câu hỏi</div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setSections((prev) =>
                                    prev.map((s, i) =>
                                      i === activeSectionIndex ? { ...s, questions: [...s.questions, makeEmptyQuestion()] } : s,
                                    ),
                                  );
                                }}
                              >
                                + Thêm câu hỏi
                              </Button>
                            </div>

                            <div className="space-y-4">
                              {sections[activeSectionIndex].questions.map((q, qIdx) => (
                                <Card key={q.id} className="p-3 bg-gray-50">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-900">Câu hỏi {qIdx + 1}</div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setSections((prev) =>
                                          prev.map((s, i) => {
                                            if (i !== activeSectionIndex) return s;
                                            return { ...s, questions: s.questions.filter((_, j) => j !== qIdx) };
                                          }),
                                        );
                                      }}
                                      className="text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                      Xóa
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                    <div className="md:col-span-1">
                                      <label className="text-sm font-medium text-gray-700">Loại</label>
                                      <select
                                        value={q.type}
                                        onChange={(e) => {
                                          const v = e.target.value as QuestionType;
                                          setSections((prev) =>
                                            prev.map((s, i) => {
                                              if (i !== activeSectionIndex) return s;
                                              return {
                                                ...s,
                                                questions: s.questions.map((qq, j) => {
                                                  if (j !== qIdx) return qq;
                                                  // If switching to true_false, prefill options with True/False for convenience.
                                                  if (v === "true_false") {
                                                    return {
                                                      ...qq,
                                                      type: v,
                                                      subquestions: qq.subquestions.map((sq) => ({
                                                        ...sq,
                                                        optionsText: sq.optionsText?.trim() ? sq.optionsText : "True\nFalse",
                                                      })),
                                                    };
                                                  }
                                                  return { ...qq, type: v };
                                                }),
                                              };
                                            }),
                                          );
                                        }}
                                        className="mt-2 w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                                      >
                                        <option value="multiple_choice">multiple_choice</option>
                                        <option value="true_false">true_false</option>
                                        <option value="fill_blank">fill_blank</option>
                                        <option value="matching">matching</option>
                                        <option value="map_labeling">map_labeling</option>
                                      </select>
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="text-sm font-medium text-gray-700">Đề bài</label>
                                      <Input
                                        value={q.prompt}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setSections((prev) =>
                                            prev.map((s, i) => {
                                              if (i !== activeSectionIndex) return s;
                                              return {
                                                ...s,
                                                questions: s.questions.map((qq, j) => (j === qIdx ? { ...qq, prompt: v } : qq)),
                                              };
                                            }),
                                          );
                                        }}
                                        className="mt-2"
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="font-medium text-gray-900">Câu hỏi phụ</div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setSections((prev) =>
                                            prev.map((s, i) => {
                                              if (i !== activeSectionIndex) return s;
                                              return {
                                                ...s,
                                                questions: s.questions.map((qq, j) =>
                                                  j === qIdx ? { ...qq, subquestions: [...qq.subquestions, makeEmptySubquestion()] } : qq,
                                                ),
                                              };
                                            }),
                                          );
                                        }}
                                      >
                                        + Thêm câu hỏi phụ
                                      </Button>
                                    </div>

                                    <div className="space-y-3">
                                      {q.subquestions.map((sq, sqIdx) => (
                                        <Card key={sq.id} className="p-3 bg-white">
                                          <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold text-gray-900">Câu hỏi phụ {sqIdx + 1}</div>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              onClick={() => {
                                                setSections((prev) =>
                                                  prev.map((s, i) => {
                                                    if (i !== activeSectionIndex) return s;
                                                    return {
                                                      ...s,
                                                      questions: s.questions.map((qq, j) => {
                                                        if (j !== qIdx) return qq;
                                                        return { ...qq, subquestions: qq.subquestions.filter((_, k) => k !== sqIdx) };
                                                      }),
                                                    };
                                                  }),
                                                );
                                              }}
                                              className="text-red-600 border-red-200 hover:bg-red-50"
                                            >
                                              Xóa
                                            </Button>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            <div>
                                              <label className="text-sm font-medium text-gray-700">Đề bài phụ (tùy chọn)</label>
                                              <Input
                                                value={sq.subprompt}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  setSections((prev) =>
                                                    prev.map((s, i) => {
                                                      if (i !== activeSectionIndex) return s;
                                                      return {
                                                        ...s,
                                                        questions: s.questions.map((qq, j) => {
                                                          if (j !== qIdx) return qq;
                                                          return {
                                                            ...qq,
                                                            subquestions: qq.subquestions.map((sqq, k) => (k === sqIdx ? { ...sqq, subprompt: v } : sqq)),
                                                          };
                                                        }),
                                                      };
                                                    }),
                                                  );
                                                }}
                                                className="mt-2"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-sm font-medium text-gray-700">Đáp án</label>
                                              <Input
                                                value={sq.answerText}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  setSections((prev) =>
                                                    prev.map((s, i) => {
                                                      if (i !== activeSectionIndex) return s;
                                                      return {
                                                        ...s,
                                                        questions: s.questions.map((qq, j) => {
                                                          if (j !== qIdx) return qq;
                                                          return {
                                                            ...qq,
                                                            subquestions: qq.subquestions.map((sqq, k) => (k === sqIdx ? { ...sqq, answerText: v } : sqq)),
                                                          };
                                                        }),
                                                      };
                                                    }),
                                                  );
                                                }}
                                                className="mt-2"
                                                placeholder='Ví dụ: A, 1, true, ["a","b"]'
                                              />
                                            </div>
                                          </div>

                                          <div className="mt-3">
                                            <label className="text-sm font-medium text-gray-700">Lựa chọn (mỗi dòng một lựa chọn)</label>
                                            <textarea
                                              value={q.type === "true_false" ? "True\nFalse" : sq.optionsText}
                                              onChange={(e) => {
                                                const v = e.target.value;
                                                setSections((prev) =>
                                                  prev.map((s, i) => {
                                                    if (i !== activeSectionIndex) return s;
                                                    return {
                                                      ...s,
                                                      questions: s.questions.map((qq, j) => {
                                                        if (j !== qIdx) return qq;
                                                        return {
                                                          ...qq,
                                                          subquestions: qq.subquestions.map((sqq, k) => (k === sqIdx ? { ...sqq, optionsText: v } : sqq)),
                                                        };
                                                      }),
                                                    };
                                                  }),
                                                );
                                              }}
                                              disabled={q.type === "true_false"}
                                              className="mt-2 w-full min-h-[90px] p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-xs disabled:opacity-70"
                                              placeholder={"A\nB\nC\nD"}
                                            />
                                            {q.type === "fill_blank" && (
                                              <div className="text-xs text-gray-500 mt-1">Mẹo: đối với fill_blank bạn có thể để trống lựa chọn.</div>
                                            )}
                                          </div>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">Chưa chọn phần nào.</div>
                        )}
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {skill === "writing" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nhiệm vụ 1</label>
                    <textarea
                      value={writing.taskone}
                      onChange={(e) => setWriting((p) => ({ ...p, taskone: e.target.value }))}
                      className="mt-2 w-full min-h-[120px] p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Đề bài nhiệm vụ 1..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nhiệm vụ 2</label>
                    <textarea
                      value={writing.tasktwo}
                      onChange={(e) => setWriting((p) => ({ ...p, tasktwo: e.target.value }))}
                      className="mt-2 w-full min-h-[120px] p-3 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Đề bài nhiệm vụ 2..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">URL hình ảnh (tùy chọn)</label>
                      <Input
                        value={writing.img ?? ""}
                        onChange={(e) => setWriting((p) => ({ ...p, img: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Mô tả hình ảnh (tùy chọn)</label>
                      <Input
                        value={writing.imgDescription ?? ""}
                        onChange={(e) => setWriting((p) => ({ ...p, imgDescription: e.target.value }))}
                        placeholder="Mô tả hình ảnh..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {skill === "speaking" && (
                <div className="space-y-4">
                  {([1, 2, 3] as const).map((partNo) => (
                    <Card key={partNo} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-gray-900">Phần {partNo}</div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setSpeakingParts((prev) => ({
                              ...prev,
                              [partNo]: [...prev[partNo], { prompt: "" }],
                            }))
                          }
                        >
                          + Thêm câu hỏi
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {speakingParts[partNo].map((q, idx) => (
                          <div key={`${partNo}-${idx}`} className="flex items-center gap-2">
                            <Input
                              value={q.prompt}
                              onChange={(e) => {
                                const v = e.target.value;
                                setSpeakingParts((prev) => ({
                                  ...prev,
                                  [partNo]: prev[partNo].map((qq, i) => (i === idx ? { prompt: v } : qq)),
                                }));
                              }}
                              placeholder={`Câu hỏi phần ${partNo} số ${idx + 1}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setSpeakingParts((prev) => ({
                                  ...prev,
                                  [partNo]: prev[partNo].filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Xóa
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {result && (
                <div className="mt-3 p-3 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm space-y-2">
                  <div className="font-semibold">Đã tạo</div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-emerald-900/90">
                    {JSON.stringify(result, null, 2)}
                  </pre>

                  {createdId && (
                    <div className="pt-2">
                      <Button asChild variant="outline">
                        <Link href={`/assignment/${skill}/${createdId}`}>Mở bài tập</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}








