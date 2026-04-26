"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { X, Plus, Trash2, LayoutGrid, Type, ListChecks } from "lucide-react";

import {
  createListeningAssignment,
  createReadingAssignment,
  createSpeakingAssignment,
  createWritingAssignment,
} from "@/services/assignment.service";
import { getClasses } from "@/services/class.service";
import type { ClassData, ClassResponse } from "@/types/class";
import type {
  CreateReadingOrListeningAssignmentPayload,
  CreateSpeakingAssignmentPayload,
  CreateWritingAssignmentPayload,
  QuestionV2Authoring,
} from "@/types/assignment";

type Skill = "reading" | "listening" | "writing" | "speaking";

type QuestionType =
  | "gap_fill_template"
  | "multiple_choice_single"
  | "multiple_choice_multi"
  | "true_false_not_given"
  | "yes_no_not_given"
  | "matching"
  | "matching_headings"
  | "diagram_labeling"
  | "short_answer"
  | "form_completion";

function uuid() {
  return crypto.randomUUID();
}

// ==========================================
// STATE INTERFACES
// ==========================================

interface QuestionFormV2 {
  id: string;
  type: QuestionType;
  prompt_md: string;
  options: { id: string; label_md: string }[];
  matchingLeft: { id: string; label_md: string }[];
  matchingRight: { id: string; label_md: string }[];
  blanks: { id: string; placeholder: string; answer: string }[];
  correct_answer: any;
}

interface QuestionGroupFormV2 {
  id: string;
  instructions_md: string;
  questions: QuestionFormV2[];
}

interface SectionFormV2 {
  id: string;
  title: string;
  reading_document_md: string;
  listening_audio_url: string;
  listening_transcript_md: string;
  question_groups: QuestionGroupFormV2[];
}

interface WritingTaskFormV2 {
  id: string;
  task_number: number;
  prompt_md: string;
  stimulus_image_url: string;
  stimulus_description_md: string;
}

interface SpeakingPartFormV2 {
  part_number: number;
  question_md: string;
}

// ==========================================
// FACTORY FUNCTIONS
// ==========================================

const createEmptyQuestion = (type: QuestionType = "short_answer"): QuestionFormV2 => ({
  id: uuid(),
  type,
  prompt_md: "",
  options: [{ id: "A", label_md: "" }, { id: "B", label_md: "" }, { id: "C", label_md: "" }],
  matchingLeft: [{ id: uuid(), label_md: "" }],
  matchingRight: [{ id: "A", label_md: "" }],
  blanks: [{ id: "1", placeholder: "Type here...", answer: "" }],
  correct_answer: ""
});

const createEmptyGroup = (): QuestionGroupFormV2 => ({
  id: uuid(),
  instructions_md: "",
  questions: [createEmptyQuestion()]
});

const createEmptySection = (): SectionFormV2 => ({
  id: uuid(),
  title: "Section 1",
  reading_document_md: "",
  listening_audio_url: "",
  listening_transcript_md: "",
  question_groups: [createEmptyGroup()]
});

export default function CreateAssignmentPage() {
  const [skill, setSkill] = useState<Skill>("reading");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [availableClasses, setAvailableClasses] = useState<ClassData[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);

  // States: Reading / Listening
  const [sections, setSections] = useState<SectionFormV2[]>([createEmptySection()]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  // States: Writing
  const [writingTasks, setWritingTasks] = useState<WritingTaskFormV2[]>([
    { id: uuid(), task_number: 1, prompt_md: "", stimulus_image_url: "", stimulus_description_md: "" },
    { id: uuid(), task_number: 2, prompt_md: "", stimulus_image_url: "", stimulus_description_md: "" },
  ]);

  // States: Speaking
  const [speakingParts, setSpeakingParts] = useState<SpeakingPartFormV2[]>([
    { part_number: 1, question_md: "### Part 1: Discussion\n1. Question 1?" },
    { part_number: 2, question_md: "### Part 2: Cue Card\n**Topic:**\n* You should say:\n" },
    { part_number: 3, question_md: "### Part 3: Follow-up\n1. Question 1?" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    getClasses().then(res => {
      const payload = res?.data as ClassResponse;
      setAvailableClasses([...(payload?.created || []), ...(payload?.teaching || [])]);
      setClassesLoading(false);
    }).catch(() => setClassesLoading(false));
  }, []);

  // ==========================================
  // PAYLOAD GENERATORS
  // ==========================================

  const readingListeningPayload = useMemo((): CreateReadingOrListeningAssignmentPayload => {
    return {
      skill: skill === "listening" ? "listening" : "reading",
      class_id: selectedClassId || undefined,
      title: assignmentTitle,
      description: description || undefined,
      is_public: isPublic,
      sections: sections.map((sec, sIdx) => ({
        id: sec.id,
        title: sec.title,
        order_index: sIdx + 1,
        material: skill === "reading"
          ? { type: "reading", document_md: sec.reading_document_md }
          : { type: "listening", audio: { id: uuid(), kind: "audio", url: sec.listening_audio_url }, transcript_md: sec.listening_transcript_md },
        question_groups: sec.question_groups.map((group, gIdx) => ({
          id: group.id,
          order_index: gIdx + 1,
          instructions_md: group.instructions_md,
          questions: group.questions.map((q, qIdx) => {
            const base: any = {
              id: q.id,
              order_index: qIdx + 1,
              type: q.type,
              prompt_md: q.prompt_md,
            };

            switch (q.type) {
              case "multiple_choice_single":
                base.interaction = { options: q.options };
                base.answer_key = { correct_answer: q.correct_answer };
                break;
              case "true_false_not_given":
              case "yes_no_not_given":
                base.interaction = {
                  options: q.type === "true_false_not_given"
                    ? [{ id: "TRUE", label_md: "TRUE" }, { id: "FALSE", label_md: "FALSE" }, { id: "NOT_GIVEN", label_md: "NOT GIVEN" }]
                    : [{ id: "YES", label_md: "YES" }, { id: "NO", label_md: "NO" }, { id: "NOT_GIVEN", label_md: "NOT GIVEN" }]
                };
                base.answer_key = { correct_answer: q.correct_answer };
                break;
              case "gap_fill_template":
              case "form_completion":
                base.interaction = { blanks: q.blanks.map(b => ({ id: b.id, placeholder_label: b.placeholder })) };
                const blankAnswers: Record<string, string> = {};
                q.blanks.forEach(b => blankAnswers[b.id] = b.answer);
                base.answer_key = { blanks: blankAnswers };
                break;
              case "matching":
              case "matching_headings":
                base.interaction = { left: q.matchingLeft, right: q.matchingRight };
                base.answer_key = { map: q.correct_answer };
                break;
              case "short_answer":
                base.interaction = { placeholder: "Write your answer...", max_length: 200 };
                base.answer_key = { correct_answer: q.correct_answer };
                break;
            }
            return base as QuestionV2Authoring;
          })
        }))
      }))
    };
  }, [skill, assignmentTitle, description, isPublic, sections, selectedClassId]);

  const writingPayload = useMemo((): CreateWritingAssignmentPayload => {
    return {
      title: assignmentTitle,
      class_id: selectedClassId || undefined,
      description: description || undefined,
      is_public: isPublic,
      tasks: writingTasks.map(t => {
        const payload: any = { task_number: t.task_number, format: "academic", prompt_md: t.prompt_md };
        if (t.stimulus_image_url || t.stimulus_description_md) {
          payload.stimulus = {
            images: t.stimulus_image_url ? [{ id: uuid(), kind: "image", url: t.stimulus_image_url }] : [],
            data_description_md: t.stimulus_description_md || undefined
          };
        }
        return payload;
      })
    };
  }, [assignmentTitle, description, isPublic, writingTasks, selectedClassId]);

  const speakingPayload = useMemo((): CreateSpeakingAssignmentPayload => {
    return {
      title: assignmentTitle,
      class_id: selectedClassId || undefined,
      description: description || undefined,
      is_public: isPublic,
      parts: speakingParts.map(p => ({
        part_number: p.part_number,
        question: p.question_md
      }))
    };
  }, [assignmentTitle, description, isPublic, speakingParts, selectedClassId]);

  // ==========================================
  // SUBMIT HANDLER
  // ==========================================

  const submit = async () => {
    if (!assignmentTitle.trim()) {
      setError("Vui lòng nhập tiêu đề bài tập.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      let res: any;
      if (skill === "reading") res = await createReadingAssignment(readingListeningPayload);
      else if (skill === "listening") res = await createListeningAssignment(readingListeningPayload);
      else if (skill === "writing") res = await createWritingAssignment(writingPayload);
      else res = await createSpeakingAssignment(speakingPayload);

      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi khi tạo bài tập");
    } finally {
      setSubmitting(false);
    }
  };

  const createdId = result?.data?.data?._id || result?.data?.data?.id || result?.data?._id || null;

  // ==========================================
  // RENDER QUESTION EDITOR (READING/LISTENING)
  // ==========================================

  const renderQuestionEditor = (q: QuestionFormV2, gIdx: number, qIdx: number) => {
    const updateQ = (data: Partial<QuestionFormV2>) => {
      setSections(prev => prev.map((s, i) => i === activeSectionIndex ? {
        ...s, question_groups: s.question_groups.map((g, j) => j === gIdx ? {
          ...g, questions: g.questions.map((qq, k) => k === qIdx ? { ...qq, ...data } : qq)
        } : g)
      } : s));
    };

    return (
      <div className="space-y-4">
        {(q.type === "multiple_choice_single" || q.type === "true_false_not_given" || q.type === "yes_no_not_given") && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Options & Correct Answer</label>
            {q.type === "multiple_choice_single" && q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex gap-2">
                <Input
                  value={opt.id}
                  onChange={e => { const newOpts = [...q.options]; newOpts[oIdx].id = e.target.value; updateQ({ options: newOpts }); }}
                  className="w-16 font-bold text-center"
                />
                <Input
                  value={opt.label_md}
                  onChange={e => { const newOpts = [...q.options]; newOpts[oIdx].label_md = e.target.value; updateQ({ options: newOpts }); }}
                  placeholder="Option text..."
                />
                <Button variant={q.correct_answer === opt.id ? "default" : "outline"} onClick={() => updateQ({ correct_answer: opt.id })} size="sm">
                  Correct
                </Button>
              </div>
            ))}
            {(q.type === "true_false_not_given" || q.type === "yes_no_not_given") && (
              <div className="flex gap-2">
                {(q.type === "true_false_not_given" ? ["TRUE", "FALSE", "NOT_GIVEN"] : ["YES", "NO", "NOT_GIVEN"]).map(val => (
                  <Button key={val} variant={q.correct_answer === val ? "default" : "outline"} onClick={() => updateQ({ correct_answer: val })}>
                    {val.replace("_", " ")}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {(q.type === "gap_fill_template" || q.type === "form_completion") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              {/* Đã Fix lỗi TS(2353) tại đây */}
              <label className="text-xs font-bold text-slate-500 uppercase">Blanks ({"{{blank:id}}"})</label>
              <Button size="sm" onClick={() => updateQ({ blanks: [...q.blanks, { id: String(q.blanks.length + 1), placeholder: "", answer: "" }] })}>+ Add Blank</Button>
            </div>
            {q.blanks.map((b, bIdx) => (
              <div key={bIdx} className="grid grid-cols-3 gap-2 bg-white p-2 rounded border border-slate-100">
                <Input value={b.id} disabled className="bg-slate-50" />
                <Input value={b.placeholder} onChange={e => { const nb = [...q.blanks]; nb[bIdx].placeholder = e.target.value; updateQ({ blanks: nb }); }} placeholder="Placeholder..." />
                <Input value={b.answer} onChange={e => { const nb = [...q.blanks]; nb[bIdx].answer = e.target.value; updateQ({ blanks: nb }); }} placeholder="Correct Answer" className="border-emerald-200" />
              </div>
            ))}
          </div>
        )}

        {(q.type === "matching" || q.type === "matching_headings") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold">Left Side (Questions)</label>
              {q.matchingLeft.map((l, lIdx) => (
                <Input key={lIdx} value={l.label_md} onChange={e => { const nl = [...q.matchingLeft]; nl[lIdx].label_md = e.target.value; updateQ({ matchingLeft: nl }); }} placeholder="Question/Statement..." />
              ))}
              <Button size="sm" variant="ghost" onClick={() => updateQ({ matchingLeft: [...q.matchingLeft, { id: uuid(), label_md: "" }] })}>+ Add Left</Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold">Right Side (Options)</label>
              {q.matchingRight.map((r, rIdx) => (
                <div key={rIdx} className="flex gap-1">
                  <Input value={r.id} className="w-12" onChange={e => { const nr = [...q.matchingRight]; nr[rIdx].id = e.target.value; updateQ({ matchingRight: nr }); }} />
                  <Input value={r.label_md} onChange={e => { const nr = [...q.matchingRight]; nr[rIdx].label_md = e.target.value; updateQ({ matchingRight: nr }); }} placeholder="Heading/Option..." />
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => updateQ({ matchingRight: [...q.matchingRight, { id: String.fromCharCode(65 + q.matchingRight.length), label_md: "" }] })}>+ Add Right</Button>
            </div>
          </div>
        )}

        {q.type === "short_answer" && (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Correct Answer</label>
            <Input value={q.correct_answer} onChange={e => updateQ({ correct_answer: e.target.value })} placeholder="Exactly as student should type..." className="mt-1 border-emerald-200" />
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <div className="w-full px-6 py-10 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Assignment Studio</h1>
          <p className="text-slate-500 text-lg">Professional IELTS Builder supporting all API Question Types.</p>
        </div>
        <div className="flex gap-3">
          <Button size="lg" onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
            {submitting ? "Saving..." : "Save Assignment"}
          </Button>
        </div>
      </div>

      {error && <div className="mb-6 p-4 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}
      {result && (
        <div className="mb-6 p-4 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm space-y-3">
          <div className="font-semibold text-emerald-900">✅ Khởi tạo thành công!</div>
          <pre className="whitespace-pre-wrap break-words text-xs bg-emerald-100/50 p-3 rounded-md font-mono text-emerald-900/90 max-h-40 overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
          {createdId && (
            <Button asChild variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
              <Link href={`/assignment/${skill}/${createdId}`}>Xem bài tập vừa tạo</Link>
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Left: General Settings */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-6 shadow-sm border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-600">Skill</label>
                <Tabs value={skill} onValueChange={v => setSkill(v as Skill)} className="mt-1">
                  <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full h-auto flex-wrap">
                    <TabsTrigger value="reading">Read</TabsTrigger>
                    <TabsTrigger value="listening">Listen</TabsTrigger>
                    <TabsTrigger value="writing">Write</TabsTrigger>
                    <TabsTrigger value="speaking">Speak</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Title</label>
                <Input value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} placeholder="IELTS Test Title..." className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Description</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description..." className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600">Class</label>
                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm mt-1">
                  <option value="">Public</option>
                  {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {(skill === "reading" || skill === "listening") && (
            <Card className="p-4 border-slate-200">
              <h3 className="font-bold text-sm text-slate-800 mb-3">Sections</h3>
              <div className="space-y-2">
                {sections.map((s, i) => (
                  <div key={s.id} onClick={() => setActiveSectionIndex(i)} className={`p-3 rounded-md cursor-pointer border transition-all ${activeSectionIndex === i ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}`}>
                    <div className="font-bold text-xs uppercase">Section {i + 1}</div>
                    <div className="text-sm truncate">{s.title || "Untitled"}</div>
                  </div>
                ))}
                <Button variant="outline" className="w-full border-dashed" onClick={() => setSections([...sections, createEmptySection()])}>+ New Section</Button>
              </div>
            </Card>
          )}
        </div>

        {/* Content Right: Dynamic Builder Based on Skill */}
        <div className="lg:col-span-9">
          {/* READING / LISTENING UI */}
          {(skill === "reading" || skill === "listening") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Type className="w-5 h-5 text-indigo-500" /> Material</h3>
                  <Input value={sections[activeSectionIndex]?.title || ''} onChange={e => { const ns = [...sections]; ns[activeSectionIndex].title = e.target.value; setSections(ns); }} className="w-1/2 h-8 text-sm" placeholder="Section title..." />
                </div>
                {skill === "reading" ? (
                  <textarea
                    value={sections[activeSectionIndex]?.reading_document_md || ''}
                    onChange={e => { const ns = [...sections]; ns[activeSectionIndex].reading_document_md = e.target.value; setSections(ns); }}
                    className="w-full h-[600px] p-4 rounded-lg border border-slate-200 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Write passage content in Markdown..."
                  />
                ) : (
                  <div className="space-y-4">
                    <Input value={sections[activeSectionIndex]?.listening_audio_url || ''} onChange={e => { const ns = [...sections]; ns[activeSectionIndex].listening_audio_url = e.target.value; setSections(ns); }} placeholder="Audio URL (Dropbox, S3, etc.)" />
                    <textarea
                      value={sections[activeSectionIndex]?.listening_transcript_md || ''}
                      onChange={e => { const ns = [...sections]; ns[activeSectionIndex].listening_transcript_md = e.target.value; setSections(ns); }}
                      className="w-full h-[540px] p-4 rounded-lg border border-slate-200 font-mono text-sm outline-none"
                      placeholder="Transcript content (Optional)..."
                    />
                  </div>
                )}
              </Card>

              <div className="space-y-6">
                <div className="flex items-center justify-between bg-indigo-900 p-4 rounded-t-xl text-white">
                  <h3 className="font-bold flex items-center gap-2"><ListChecks className="w-5 h-5" /> Question Groups</h3>
                  <Button size="sm" variant="secondary" onClick={() => { const ns = [...sections]; ns[activeSectionIndex].question_groups.push(createEmptyGroup()); setSections(ns); }}>+ New Group</Button>
                </div>
                <div className="space-y-6 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                  {sections[activeSectionIndex]?.question_groups.map((group, gIdx) => (
                    <Card key={group.id} className="p-6 border-l-4 border-l-indigo-500 shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <Input value={group.instructions_md} onChange={e => { const ns = [...sections]; ns[activeSectionIndex].question_groups[gIdx].instructions_md = e.target.value; setSections(ns); }} className="font-bold text-slate-800 border-none bg-slate-50 h-8" placeholder="Instructions..." />
                        <Button variant="ghost" size="sm" onClick={() => { const ns = [...sections]; ns[activeSectionIndex].question_groups = ns[activeSectionIndex].question_groups.filter((_, i) => i !== gIdx); setSections(ns); }}><Trash2 className="w-4 h-4 text-slate-400" /></Button>
                      </div>
                      <div className="space-y-8">
                        {group.questions.map((q, qIdx) => (
                          <div key={q.id} className="p-5 bg-slate-50/50 rounded-xl border border-slate-100 relative">
                            <div className="flex items-center gap-4 mb-4">
                              <span className="bg-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-indigo-600 shadow-sm border border-indigo-100">{qIdx + 1}</span>
                              <select value={q.type} onChange={e => { const nt = e.target.value as QuestionType; const ns = [...sections]; ns[activeSectionIndex].question_groups[gIdx].questions[qIdx] = createEmptyQuestion(nt); setSections(ns); }} className="h-8 px-2 rounded border border-slate-200 text-xs font-bold text-indigo-700 bg-white">
                                <option value="short_answer">SHORT ANSWER</option>
                                <option value="multiple_choice_single">MCQ SINGLE</option>
                                <option value="multiple_choice_multi">MCQ MULTI</option>
                                <option value="true_false_not_given">TFNG</option>
                                <option value="yes_no_not_given">YNNG</option>
                                <option value="gap_fill_template">GAP FILL</option>
                                <option value="matching">MATCHING</option>
                                <option value="matching_headings">MATCHING HEADINGS</option>
                                <option value="form_completion">FORM COMPLETION</option>
                              </select>
                              <Input value={q.prompt_md} onChange={e => { const ns = [...sections]; ns[activeSectionIndex].question_groups[gIdx].questions[qIdx].prompt_md = e.target.value; setSections(ns); }} className="flex-1 h-8 bg-white" placeholder="Question prompt..." />
                            </div>
                            {renderQuestionEditor(q, gIdx, qIdx)}
                          </div>
                        ))}
                        <Button variant="outline" className="w-full bg-white border-indigo-100 text-indigo-600 hover:bg-indigo-50" onClick={() => { const ns = [...sections]; ns[activeSectionIndex].question_groups[gIdx].questions.push(createEmptyQuestion()); setSections(ns); }}>+ Add Question</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* WRITING UI */}
          {skill === "writing" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {writingTasks.map((task, tIdx) => (
                <Card key={task.id} className="p-6 border-slate-200 shadow-sm">
                  <h3 className="font-bold text-xl text-slate-800 mb-4 flex items-center gap-2"><Type className="w-5 h-5 text-indigo-500" /> Task {task.task_number}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Đề bài (Prompt MD)</label>
                      <textarea value={task.prompt_md} onChange={e => setWritingTasks(prev => prev.map((t, i) => i === tIdx ? { ...t, prompt_md: e.target.value } : t))} className="mt-1 w-full min-h-[150px] p-3 rounded-md border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-md space-y-3">
                      <div className="font-medium text-sm text-slate-700">Stimulus (Biểu đồ / Dữ liệu)</div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Image URL</label>
                        <Input value={task.stimulus_image_url} onChange={e => setWritingTasks(prev => prev.map((t, i) => i === tIdx ? { ...t, stimulus_image_url: e.target.value } : t))} className="mt-1 h-9 bg-white" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Description MD</label>
                        <Input value={task.stimulus_description_md} onChange={e => setWritingTasks(prev => prev.map((t, i) => i === tIdx ? { ...t, stimulus_description_md: e.target.value } : t))} className="mt-1 h-9 bg-white" placeholder="Mô tả dữ liệu..." />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* SPEAKING UI */}
          {skill === "speaking" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {speakingParts.map((part, pIdx) => (
                <Card key={pIdx} className="p-6 border-slate-200 shadow-sm">
                  <h3 className="font-bold text-xl text-slate-800 mb-4 flex items-center gap-2"><Type className="w-5 h-5 text-indigo-500" /> Part {part.part_number}</h3>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Câu hỏi (Markdown)</label>
                    <textarea value={part.question_md} onChange={e => setSpeakingParts(prev => prev.map((p, i) => i === pIdx ? { ...p, question_md: e.target.value } : p))} className="mt-1 w-full min-h-[300px] p-3 rounded-md border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}