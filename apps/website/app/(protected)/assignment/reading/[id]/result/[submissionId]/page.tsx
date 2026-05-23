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
import ScoreReveal from "@/components/score-reveal";
import Image from "next/image";
import readingImage from "@/assets/assignment-reading.png";

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
        result?.details?.forEach((sec) =>
            sec.questions?.forEach((q: any) => {
                if (q.parts && q.parts.length > 0) {
                    map.set(q.question_id, q.parts[0]?.submitted_answer);
                } else {
                    map.set(q.question_id, (q as any).answer);
                }
            }),
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
        const correctAnswer = key?.choice ?? key?.choices ?? key?.correct_answer ?? key?.text ?? key?.map ?? key;
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
                setAssignment(r1);
                setResult(r2);
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
            <div
                className="flex items-center justify-center h-screen"
                style={{ backgroundColor: "var(--color-surface-app)" }}
            >
                <div
                    className="text-center p-8 rounded-2xl"
                    style={{
                        backgroundColor: "var(--color-surface-card)",
                        border: "1px solid var(--color-border-default)",
                    }}
                >
                    <p className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        Không tìm thấy dữ liệu
                    </p>
                </div>
            </div>
        );
    }

    const section = assignment.sections[activePassage] as any;
    const sectionResult =
        result.details.find((sec) => sec.section_id === section.id) ?? result.details[activePassage];

    const bandScore =
        result.score ??
        (() => {
            const totalQ = result.total_questions || 1;
            const rawBand = (result.correct_answers / totalQ) * 9;
            return Math.max(0, Math.min(9, Math.round(rawBand * 2) / 2));
        })();

    const getCorrectAnswer = (val: any) => {
        if (val && typeof val === "object" && "correct_answer" in val) {
            return (val as any).correct_answer;
        }
        return val;
    };

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--color-surface-app)" }}>
            <div
                className="flex border mx-2 mt-9 mb-8"
                style={{
                    height: "calc(100vh - 80px)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: "16px",
                    overflow: "hidden",
                }}
            >
                {/* LEFT — Passage panel */}
                <div
                    className="flex-1 flex flex-col overflow-hidden"
                    style={{ borderRight: "1px solid var(--color-border-subtle)", backgroundColor: "var(--color-surface-card)" }}
                >
                    <div className="p-6 overflow-y-auto h-full">
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

                {/* RIGHT — Result review */}
                <div
                    className="w-[45%] flex flex-col overflow-hidden"
                    style={{ backgroundColor: "var(--color-surface-card)" }}
                >
                    <div className="flex-1 p-6 overflow-y-auto">

                        {/* Score card — warm */}
                        <div
                            className="rounded-2xl p-5 mb-6"
                            style={{
                                backgroundColor: "var(--color-surface-subtle)",
                                border: "1.5px solid var(--color-border-default)",
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="animate-float flex-shrink-0">
                                    <Image src={readingImage} alt="" width={52} height={52} className="object-contain" />
                                </div>
                                <div className="flex-1">
                                    <p
                                        className="text-xs font-bold uppercase tracking-widest mb-1"
                                        style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-body)" }}
                                    >
                                        Tổng điểm
                                    </p>
                                    <ScoreReveal score={bandScore} />
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div
                                        className="text-2xl font-bold"
                                        style={{ fontFamily: "var(--font-mono)", color: "var(--color-brand)" }}
                                    >
                                        {result.percentage}%
                                    </div>
                                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>Chính xác</div>
                                </div>
                            </div>
                            <div
                                className="grid grid-cols-2 gap-3 mt-4 pt-4"
                                style={{ borderTop: "1px solid var(--color-border-subtle)" }}
                            >
                                <div
                                    className="rounded-xl p-3"
                                    style={{
                                        backgroundColor: "var(--color-surface-card)",
                                        border: "1px solid var(--color-border-default)",
                                    }}
                                >
                                    <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Đúng</div>
                                    <div
                                        className="font-bold text-lg"
                                        style={{ color: "var(--color-correct)", fontFamily: "var(--font-mono)" }}
                                    >
                                        {result.correct_answers}
                                    </div>
                                </div>
                                <div
                                    className="rounded-xl p-3"
                                    style={{
                                        backgroundColor: "var(--color-surface-card)",
                                        border: "1px solid var(--color-border-default)",
                                    }}
                                >
                                    <div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>Sai</div>
                                    <div
                                        className="font-bold text-lg"
                                        style={{ color: "var(--color-error)", fontFamily: "var(--font-mono)" }}
                                    >
                                        {result.incorrect_answers}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section title */}
                        <div className="mb-5">
                            <h3
                                className="text-xl font-bold"
                                style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
                            >
                                {section.title}
                            </h3>
                        </div>

                        {/* Questions review */}
                        <div className="space-y-5">
                            {sectionResult?.questions?.map((q) => {
                                const meta = questionMeta.get(q.question_id);
                                const label =
                                    meta?.order !== undefined
                                        ? `Question ${meta.order}`
                                        : `Question ${q.question_id}`;
                                const prompt = (meta?.prompt || "").replace(/<[^>]+>/g, "").slice(0, 200);
                                const detailParts =
                                    (q.parts && q.parts.length
                                        ? q.parts
                                        : buildFallbackParts(q.question_id)) ?? [];
                                const getSubmittedAnswer = (part: any) => {
                                    if (part?.submitted_answer !== undefined) return part.submitted_answer;
                                    const fromMap = submittedAnswersByQuestion.get(q.question_id);
                                    if (fromMap && part?.key && typeof fromMap === "object" && fromMap !== null && part.key in (fromMap as any)) {
                                        return (fromMap as any)[part.key];
                                    }
                                    return fromMap !== undefined ? fromMap : "Not answered";
                                };

                                return (
                                    <div
                                        key={q.question_id}
                                        className="rounded-xl overflow-hidden"
                                        style={{
                                            backgroundColor: "var(--color-surface-card)",
                                            border: "1px solid var(--color-border-default)",
                                        }}
                                    >
                                        <div
                                            className="px-5 py-4 flex items-center justify-between"
                                            style={{
                                                backgroundColor: "var(--color-surface-subtle)",
                                                borderBottom: "1px solid var(--color-border-subtle)",
                                            }}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                                    {label}
                                                </p>
                                                {prompt ? (
                                                    <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--color-text-muted)" }}>
                                                        {prompt}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <span
                                                className="text-xs font-bold"
                                                style={{ color: q.correct ? "var(--color-correct)" : "var(--color-error)" }}
                                            >
                                                {q.correct ? "Correct" : "Incorrect"}
                                            </span>
                                        </div>
                                        <div className="text-sm p-5 space-y-3">
                                            {detailParts.map((p: any) => {
                                                const submittedAns = getSubmittedAnswer(p);
                                                const correctAns = getCorrectAnswer(p.correct_answer);
                                                const displaySubmitted = formatAnswer(submittedAns);
                                                const displayCorrect = formatAnswer(correctAns);
                                                return (
                                                    <div
                                                        key={p.key}
                                                        className="rounded-lg p-3"
                                                        style={{ border: "1px solid var(--color-border-subtle)" }}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                                                                {p.key}
                                                            </div>
                                                            <div
                                                                className="text-xs font-semibold"
                                                                style={{ color: p.correct ? "var(--color-correct)" : "var(--color-error)" }}
                                                            >
                                                                {p.correct ? "OK" : "Wrong"}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            <div
                                                                className="rounded p-2"
                                                                style={{ backgroundColor: "var(--color-surface-subtle)" }}
                                                            >
                                                                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                                    Your answer
                                                                </div>
                                                                <div className="text-sm break-words" style={{ color: "var(--color-text-primary)" }}>
                                                                    {displaySubmitted || "Not answered"}
                                                                </div>
                                                            </div>
                                                            <div
                                                                className="rounded p-2"
                                                                style={{
                                                                    backgroundColor: "#f0fdf4",
                                                                    border: "1px solid #bbf7d0",
                                                                }}
                                                            >
                                                                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                                    Correct
                                                                </div>
                                                                <div className="text-sm break-words" style={{ color: "#166534" }}>
                                                                    {displayCorrect || "-"}
                                                                </div>
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
