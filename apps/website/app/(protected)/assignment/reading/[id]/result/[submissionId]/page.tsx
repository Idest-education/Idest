"use client";

import { useEffect, useMemo, useState } from "react";
import { use } from "react";
import {
    ReadingAssignmentDetail,
    SubmissionResultV2,
} from "@/types/assignment";
import { getReadingAssignment, getReadingSubmissionResult } from "@/services/assignment.service";
import PassageTabs from "@/components/assignment/passagetabs";
import PassageContent from "@/components/assignment/passage-content";
import LoadingScreen from "@/components/loading-screen";

interface PageProps {
    params: Promise<{ id: string; submissionId: string }>;
}

export default function ReadingResultPage(props: PageProps) {
    const { id, submissionId } = use(props.params);

    const [assignment, setAssignment] = useState<ReadingAssignmentDetail | null>(null);
    const [result, setResult] = useState<SubmissionResultV2 | null>(null);
    const [activePassage, setActivePassage] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    const questionsById = useMemo(() => {
        const map = new Map<string, any>();
        assignment?.sections?.forEach((sec) =>
            (sec.question_groups ?? []).forEach((g) =>
                g.questions?.forEach((q: any) => map.set(q.id, q)),
            ),
        );
        return map;
    }, [assignment]);

    const questionMeta = useMemo(() => {
        const map = new Map<
            string,
            { order: number | undefined; prompt: string | undefined; type: string | undefined }
        >();
        assignment?.sections?.forEach((sec) =>
            (sec.question_groups ?? []).forEach((g) =>
                g.questions?.forEach((q: any) =>
                    map.set(q.id, {
                        order: q.order_index,
                        prompt: q.prompt_md || q.prompt,
                        type: q.type,
                    }),
                ),
            ),
        );
        return map;
    }, [assignment]);

    const submittedAnswersByQuestion = useMemo(() => {
        const map = new Map<string, any>();
        result?.answers_v2?.forEach((sec) =>
            sec.answers?.forEach((qa: any) => map.set(qa.question_id, qa.answer)),
        );
        return map;
    }, [result]);

    const formatAnswer = (val: any): string => {
        if (val === null || val === undefined) return "";
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return String(val);
        if (Array.isArray(val)) return val.map((v) => formatAnswer(v)).join(", ");
        if (val.choice !== undefined) return String(val.choice);
        if (val.choices !== undefined) return Array.isArray(val.choices) ? val.choices.join(", ") : String(val.choices);
        if (val.text !== undefined) return String(val.text);
        return JSON.stringify(val);
    };

    const buildFallbackParts = (questionId: string) => {
        const question = questionsById.get(questionId);
        const submitted = submittedAnswersByQuestion.get(questionId);
        const key = question?.answer_key;

        // Try common fields
        const correctAnswer =
            key?.choice ?? key?.choices ?? key?.correct_answer ?? key?.text ?? key?.map ?? key;

        const submittedAnswer = submitted?.choice ?? submitted?.choices ?? submitted?.text ?? submitted;

        if (submittedAnswer === undefined && correctAnswer === undefined) return [];

        return [
            {
                key: "answer",
                correct: correctAnswer !== undefined && formatAnswer(submittedAnswer) === formatAnswer(correctAnswer),
                submitted_answer: submittedAnswer,
                correct_answer: correctAnswer,
            },
        ];
    };

    useEffect(() => {
        async function load() {
            try {
                const r1 = await getReadingAssignment(id);
                const r2 = await getReadingSubmissionResult(submissionId);

                setAssignment(r1.data);
                setResult(r2.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id, submissionId]);

    if (loading) return <LoadingScreen />;

    if (!assignment || !result) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 to-orange-50">
                <div className="text-center space-y-3 p-8 bg-white rounded-2xl shadow-lg">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <p className="text-xl font-semibold text-gray-800">Không tìm thấy dữ liệu</p>
                </div>
            </div>
        );
    }

    const section = assignment.sections[activePassage] as any;
    const sectionResult =
        result.details.find((sec) => sec.section_id === section.id) ?? result.details[activePassage];

    // Prefer API band score; fall back to recompute if absent
    const bandScore =
        result.score ??
        (() => {
            const totalQ = result.total_questions || 1;
            const rawBand = (result.correct_answers / totalQ) * 9;
            return Math.max(0, Math.min(9, Math.round(rawBand * 2) / 2));
        })();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-1 px-1">
            <div className="flex h-screen border border-gray-300 mx-2 mt-9 mb-19">
                {/* LEFT - Passage Panel */}
                <div className="flex-1 flex flex-col border-r border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
                    <div className="p-6 overflow-y-auto">
                        <PassageTabs
                            sections={assignment.sections as any}
                            active={activePassage}
                            setActive={setActivePassage}
                        />
                        <div className="mt-6">
                            <PassageContent section={section} />
                        </div>
                    </div>
                </div>

                {/* RIGHT - Result Review */}
                <div className="w-[45%] flex flex-col bg-white/80 backdrop-blur-sm shadow-sm">

                    <div className="flex-1 p-6 overflow-y-auto">
                        {/* Score Card */}
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl p-6 mb-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm opacity-90 mb-1">Tổng điểm</p>
                                    <p className="text-4xl font-bold">
                                        {bandScore.toFixed(1)}
                                        <span className="text-sm opacity-80">/9.0</span>
                                    </p>
                                </div>
                                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-sm font-bold">{result.percentage}%</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-green-400/30 flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs opacity-80">Đúng</p>
                                            <p className="text-sm font-bold">{result.correct_answers}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-red-400/30 flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs opacity-80">Sai</p>
                                            <p className="text-sm font-bold">{result.incorrect_answers}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section Title */}
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                                {section.title}
                            </h3>
                        </div>

                        {/* Questions Review (v2) */}
                        <div className="space-y-6">
                            {sectionResult?.questions?.map((q) => {
                                const meta = questionMeta.get(q.question_id);
                                const label =
                                    meta?.order !== undefined
                                        ? `Question ${meta.order}`
                                        : `Question ${q.question_id}`;
                                const prompt =
                                    (meta?.prompt || "").replace(/<[^>]+>/g, "").slice(0, 200);
                                const detailParts =
                                    (q.parts && q.parts.length
                                        ? q.parts
                                        : q.subquestions && q.subquestions.length
                                            ? q.subquestions
                                            : buildFallbackParts(q.question_id)) ?? [];
                                const getSubmittedAnswer = (part: any) => {
                                    if (part?.submitted_answer !== undefined) return part.submitted_answer;
                                    const fromMap = submittedAnswersByQuestion.get(q.question_id);
                                    if (
                                        fromMap &&
                                        part?.key &&
                                        typeof fromMap === "object" &&
                                        fromMap !== null &&
                                        part.key in (fromMap as any)
                                    ) {
                                        return (fromMap as any)[part.key];
                                    }
                                    return fromMap !== undefined ? fromMap : "Not answered";
                                };

                                const getCorrectAnswer = (val: any) => {
                                    if (val && typeof val === "object" && "correct_answer" in val) {
                                        return (val as any).correct_answer;
                                    }
                                    return val;
                                };

                                return (
                                    <div key={q.question_id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{label}</p>
                                                {prompt ? (
                                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{prompt}</p>
                                                ) : null}
                                            </div>
                                            <span className={`text-xs font-semibold ${q.correct ? "text-green-700" : "text-red-700"}`}>
                                                {q.correct ? "Correct" : "Incorrect"}
                                            </span>
                                        </div>
                                        <div className="text-sm p-5 space-y-3">
                                            {detailParts.map((p) => {
                                                const submittedAns = getSubmittedAnswer(p);
                                                const correctAns = getCorrectAnswer(p.correct_answer);
                                                const displaySubmitted = formatAnswer(submittedAns);
                                                const displayCorrect = formatAnswer(correctAns);
                                                return (
                                                    <div key={p.key} className="rounded-lg border border-gray-200 p-3">
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-medium text-gray-800">{p.key}</div>
                                                            <div className={`text-xs font-semibold ${p.correct ? "text-green-700" : "text-red-700"}`}>
                                                                {p.correct ? "OK" : "Wrong"}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            <div className="bg-gray-50 rounded p-2">
                                                                <div className="text-xs text-gray-500">Your answer</div>
                                                                <div className="text-sm text-gray-800 break-words">{displaySubmitted || "Not answered"}</div>
                                                            </div>
                                                            <div className="bg-green-50 rounded p-2 border border-green-200">
                                                                <div className="text-xs text-gray-500">Correct</div>
                                                                <div className="text-sm text-gray-800 break-words">{displayCorrect || "—"}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}