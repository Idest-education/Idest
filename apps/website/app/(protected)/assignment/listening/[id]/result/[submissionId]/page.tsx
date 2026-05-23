"use client";

import { use, useEffect, useState } from "react";
import { getListeningAssignment, getListeningSubmissionResult } from "@/services/assignment.service";
import { ListeningAssignmentDetail, SubmissionResultV2 } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";
import ScoreReveal from "@/components/score-reveal";
import Image from "next/image";
import listeningImage from "@/assets/assignment-listening.png";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

export default function ListeningResultPage(props: Props) {
    const { id, submissionId } = use(props.params);

    const [assignment, setAssignment] = useState<ListeningAssignmentDetail | null>(null);
    const [result, setResult] = useState<SubmissionResultV2 | null>(null);
    const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [aRes, rRes] = await Promise.all([
                    getListeningAssignment(id),
                    getListeningSubmissionResult(submissionId),
                ]);
                setAssignment(aRes);
                setResult(rRes);
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

    const section = assignment.sections[activeSectionIndex];
    const sectionResult = result.details[activeSectionIndex];

    const totalQ = result.total_questions || 1;
    const rawBand = (result.correct_answers / totalQ) * 9;
    const bandScore = Math.max(0, Math.min(9, Math.round(rawBand * 2) / 2));

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--color-surface-app)" }}>
            <div
                className="flex mx-2 mt-9 mb-8"
                style={{
                    height: "calc(100vh - 80px)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: "16px",
                    overflow: "hidden",
                }}
            >
                {/* LEFT — Audio panel */}
                <div
                    className="flex-1 flex flex-col overflow-hidden"
                    style={{
                        borderRight: "1px solid var(--color-border-subtle)",
                        backgroundColor: "var(--color-surface-card)",
                    }}
                >
                    <div className="p-6 overflow-y-auto h-full">

                        {/* Section tabs */}
                        <div className="flex gap-2 mb-5 flex-wrap">
                            {assignment.sections.map((sec, idx) => {
                                const isActive = activeSectionIndex === idx;
                                return (
                                    <button
                                        key={sec.id}
                                        onClick={() => setActiveSectionIndex(idx)}
                                        className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                                        style={{
                                            backgroundColor: isActive ? "var(--color-brand)" : "var(--color-surface-subtle)",
                                            color: isActive ? "#ffffff" : "var(--color-text-secondary)",
                                            border: `1px solid ${isActive ? "var(--color-brand)" : "var(--color-border-default)"}`,
                                        }}
                                    >
                                        Bài nghe {idx + 1}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Audio player */}
                        <div
                            className="rounded-xl p-4 mb-5"
                            style={{
                                backgroundColor: "var(--color-surface-subtle)",
                                border: "1px solid var(--color-border-default)",
                            }}
                        >
                            <p
                                className="text-sm font-semibold mb-3"
                                style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-body)" }}
                            >
                                {section.title ?? sectionResult?.section_title ?? `Bài nghe ${activeSectionIndex + 1}`}
                            </p>
                            <audio
                                controls
                                src={(section as any).material?.type === "listening" ? (section as any).material.audio?.url : ""}
                                className="w-full"
                            />
                        </div>

                        {/* Transcript */}
                        {(section as any).material?.type === "listening" && (section as any).material.transcript_md && (
                            <div
                                className="rounded-xl p-4"
                                style={{
                                    backgroundColor: "var(--color-surface-card)",
                                    border: "1px solid var(--color-border-default)",
                                }}
                            >
                                <p
                                    className="text-sm font-semibold mb-2"
                                    style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-body)" }}
                                >
                                    Transcript
                                </p>
                                <p
                                    className="whitespace-pre-line leading-relaxed text-sm"
                                    style={{ color: "var(--color-text-primary)" }}
                                >
                                    {(section as any).material.transcript_md}
                                </p>
                            </div>
                        )}
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
                                    <Image src={listeningImage} alt="" width={52} height={52} className="object-contain" />
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
                                {section.title ?? sectionResult?.section_title ?? `Bài nghe ${activeSectionIndex + 1}`}
                            </h3>
                        </div>

                        {/* Questions review */}
                        <div className="space-y-5">
                            {sectionResult?.questions?.map((q, index) => (
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
                                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                            Question {index + 1}
                                        </p>
                                        <span
                                            className="text-xs font-bold"
                                            style={{ color: q.correct ? "var(--color-correct)" : "var(--color-error)" }}
                                        >
                                            {q.correct ? "Correct" : "Incorrect"}
                                        </span>
                                    </div>
                                    <div className="text-sm p-5 space-y-3">
                                        {(q.parts ?? []).map((p) => (
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
                                                            {String(p.submitted_answer ?? "")}
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="rounded p-2"
                                                        style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}
                                                    >
                                                        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                                            Correct
                                                        </div>
                                                        <div className="text-sm break-words" style={{ color: "#166534" }}>
                                                            {String(p.correct_answer ?? "")}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
