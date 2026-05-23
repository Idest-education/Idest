"use client";

import { use, useEffect, useState } from "react";
import LoadingScreen from "@/components/loading-screen";
import { getWritingAssignment, getWritingSubmissionResult } from "@/services/assignment.service";
import { RubricDetail, WritingSubmissionResult, WritingSubmissionResponse } from "@/types/assignment";
import RevelationHeader from "@/components/revelation-header";
import writingImage from "@/assets/assignment-writing.png";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

const RUBRIC_INFO = {
    task_achievement: { label: "Task Achievement (TA)", accent: "#FF6B35", bg: "#fff4ed", border: "#ffe8d6" },
    coherence:        { label: "Coherence (CC)",        accent: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    lexical:          { label: "Lexical Resource (LR)", accent: "#d97706", bg: "#fef3c7", border: "#fde68a" },
    grammar:          { label: "Grammar (GR)",          accent: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

function commentForScore(s: number) {
    if (s >= 7) return "Xuất sắc! Bạn có nền tảng viết rất vững chắc.";
    if (s >= 6) return "Rất tốt! Tiếp tục cải thiện từng tiêu chí nhé.";
    if (s >= 5) return "Tiến bộ tốt! Luyện thêm để đạt điểm cao hơn.";
    return "Tiếp tục cố gắng! Đọc nhận xét để cải thiện.";
}

const roundIeltsScore = (score: number) => {
    const fraction = score - Math.floor(score);
    if (fraction < 0.25) return Math.floor(score);
    if (fraction >= 0.25 && fraction < 0.75) return Math.floor(score) + 0.5;
    return Math.ceil(score);
};

export default function WritingResultPage(props: Props) {
    const { id, submissionId } = use(props.params);
    const [result, setResult] = useState<WritingSubmissionResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTask, setActiveTask] = useState<"task1" | "task2">("task1");
    const [activeHighlight, setActiveHighlight] = useState<keyof typeof RUBRIC_INFO | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const [, submissionRes] = await Promise.all([
                    getWritingAssignment(id),
                    getWritingSubmissionResult(submissionId),
                ]);
                const response = submissionRes as WritingSubmissionResponse;
                const resultData = response?.data ?? response;
                setResult(resultData);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id, submissionId]);

    if (loading) return <LoadingScreen />;
    if (!result) return (
        <div className="text-center mt-20" style={{ color: "var(--color-text-muted)" }}>
            Không tìm thấy kết quả
        </div>
    );

    const overallRounded = roundIeltsScore(result.score || 0);
    const currentTaskData = result?.grading_breakdown?.tasks?.[activeTask];

    const getTaskContent = (taskKey: "task1" | "task2") => {
        const contents = Object.values(result?.content_by_task_id || {});
        if (contents.length === 0) return "Không có nội dung bài viết.";
        if (contents.length === 1) return contents[0];
        const taskRubrics = result?.grading_breakdown?.tasks?.[taskKey]?.rubrics;
        const sampleQuote = Object.values(taskRubrics || {}).find(r => r?.feedback?.evidence_quote)?.feedback?.evidence_quote;
        if (sampleQuote) {
            const shortSample = sampleQuote.substring(0, 20);
            const matchedContent = contents.find(c => c.includes(shortSample));
            if (matchedContent) return matchedContent;
        }
        return contents[taskKey === "task1" ? 0 : 1];
    };

    const currentContent = getTaskContent(activeTask);

    const HighlightedEssay = ({ content, rubrics }: { content: string; rubrics: Record<string, RubricDetail> }) => {
        if (!content) return null;
        const quotes: { quote: string; type: keyof typeof RUBRIC_INFO }[] = [];
        Object.entries(rubrics || {}).forEach(([key, detail]) => {
            if (detail?.feedback?.evidence_quote) {
                quotes.push({ quote: detail.feedback.evidence_quote, type: key as keyof typeof RUBRIC_INFO });
            }
        });
        const charTypes = Array.from({ length: content.length }, () => new Set<keyof typeof RUBRIC_INFO>());
        quotes.forEach(q => {
            let cleanQuote = q.quote.trim();
            if (!cleanQuote) return;
            cleanQuote = cleanQuote.replace(/^["']|["']$/g, "").trim();
            cleanQuote = cleanQuote.replace(/[.,:;!?]+$/, "");
            const escapedQuote = cleanQuote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regexStr = escapedQuote.replace(/\s+/g, "\\s+");
            try {
                const regex = new RegExp(regexStr, "i");
                const match = content.match(regex);
                if (match && match.index !== undefined) {
                    for (let i = match.index; i < match.index + match[0].length; i++) {
                        charTypes[i].add(q.type);
                    }
                }
            } catch {
                // invalid regex, skip
            }
        });
        const segments: { text: string; types: (keyof typeof RUBRIC_INFO)[] }[] = [];
        if (content.length > 0) {
            let currentText = content[0];
            let currentTypes = Array.from(charTypes[0]);
            for (let i = 1; i < content.length; i++) {
                const types = Array.from(charTypes[i]);
                const same = types.length === currentTypes.length && types.every(t => currentTypes.includes(t));
                if (same) {
                    currentText += content[i];
                } else {
                    segments.push({ text: currentText, types: currentTypes });
                    currentText = content[i];
                    currentTypes = types;
                }
            }
            segments.push({ text: currentText, types: currentTypes });
        }
        return (
            <div
                className="leading-loose whitespace-pre-wrap text-base"
                style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-body)" }}
            >
                {segments.map((seg, idx) => {
                    if (seg.types.length === 0) return <span key={idx}>{seg.text}</span>;
                    const isActive = activeHighlight && seg.types.includes(activeHighlight);
                    const accent = RUBRIC_INFO[seg.types[0]].accent;
                    const handleClick = () => {
                        if (isActive) {
                            const ci = seg.types.indexOf(activeHighlight!);
                            setActiveHighlight(seg.types[(ci + 1) % seg.types.length]);
                        } else {
                            setActiveHighlight(seg.types[0]);
                        }
                    };
                    return (
                        <span
                            key={idx}
                            onClick={handleClick}
                            className="cursor-pointer rounded-sm transition-all"
                            style={{
                                backgroundColor: isActive ? `${accent}33` : `${accent}18`,
                                outline: isActive ? `2px solid ${accent}88` : "none",
                            }}
                            title={`Click để xem: ${seg.types.map(t => RUBRIC_INFO[t].label).join(" | ")}`}
                        >
                            {seg.text}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "var(--color-surface-app)" }}>

            <RevelationHeader
                score={overallRounded}
                catImage={writingImage}
                comment={commentForScore(overallRounded)}
                backHref="/assignment"
            />

            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

                {/* Task tabs */}
                <div className="flex gap-4" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    {(["task1", "task2"] as const).map((task) => {
                        const isActive = activeTask === task;
                        const band = result?.grading_breakdown?.tasks?.[task]?.band?.toFixed(1) ?? "-";
                        return (
                            <button
                                key={task}
                                onClick={() => { setActiveTask(task); setActiveHighlight(null); }}
                                className="pb-4 px-4 text-base font-semibold transition-colors"
                                style={{
                                    color: isActive ? "var(--color-brand)" : "var(--color-text-muted)",
                                    borderBottom: `2px solid ${isActive ? "var(--color-brand)" : "transparent"}`,
                                    fontFamily: "var(--font-body)",
                                }}
                            >
                                {task === "task1" ? "Task 1" : "Task 2"} ({band})
                            </button>
                        );
                    })}
                </div>

                {/* Rubric score tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(Object.entries(RUBRIC_INFO) as [keyof typeof RUBRIC_INFO, typeof RUBRIC_INFO[keyof typeof RUBRIC_INFO]][]).map(([key, info]) => {
                        const rubricData = currentTaskData?.rubrics[key];
                        const isActive = activeHighlight === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveHighlight(key)}
                                className="p-4 rounded-xl text-left transition-all"
                                style={{
                                    backgroundColor: isActive ? info.bg : "var(--color-surface-card)",
                                    border: `1.5px solid ${isActive ? info.accent : "var(--color-border-default)"}`,
                                    boxShadow: isActive ? `0 4px 16px ${info.accent}22` : "none",
                                }}
                            >
                                <div
                                    className="text-xs font-bold mb-1"
                                    style={{ color: info.accent, fontFamily: "var(--font-body)" }}
                                >
                                    {info.label}
                                </div>
                                <div
                                    className="text-3xl font-bold"
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        color: isActive ? info.accent : "var(--color-text-primary)",
                                    }}
                                >
                                    {rubricData?.band !== undefined ? roundIeltsScore(rubricData.band).toFixed(1) : "-"}
                                </div>
                                <div className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                                    Click xem chi tiết
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Essay + detail panel */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Essay */}
                    <div
                        className="lg:col-span-3 rounded-2xl p-8"
                        style={{
                            backgroundColor: "var(--color-surface-card)",
                            border: "1px solid var(--color-border-default)",
                        }}
                    >
                        <div
                            className="flex justify-between items-center pb-4 mb-6"
                            style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                        >
                            <h3
                                className="font-bold text-lg"
                                style={{ fontFamily: "var(--font-display)", color: "var(--color-text-primary)" }}
                            >
                                Bài làm của bạn
                            </h3>
                            <span
                                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                                style={{
                                    backgroundColor: "var(--color-surface-subtle)",
                                    color: "var(--color-brand)",
                                    fontFamily: "var(--font-body)",
                                }}
                            >
                                Click đoạn bôi màu để xem lỗi
                            </span>
                        </div>
                        <HighlightedEssay content={currentContent} rubrics={currentTaskData?.rubrics || {}} />
                    </div>

                    {/* Detail panel */}
                    <div className="lg:col-span-2 sticky top-6">
                        {activeHighlight && currentTaskData?.rubrics?.[activeHighlight]?.feedback ? (
                            <div
                                className="rounded-2xl p-6"
                                style={{
                                    backgroundColor: RUBRIC_INFO[activeHighlight].bg,
                                    border: `1.5px solid ${RUBRIC_INFO[activeHighlight].border}`,
                                }}
                            >
                                <div className="flex justify-between items-start mb-5">
                                    <h3
                                        className="text-lg font-bold"
                                        style={{ color: RUBRIC_INFO[activeHighlight].accent, fontFamily: "var(--font-display)" }}
                                    >
                                        {RUBRIC_INFO[activeHighlight].label}
                                    </h3>
                                    <span
                                        className="px-3 py-1 rounded-lg font-bold text-lg"
                                        style={{
                                            backgroundColor: "var(--color-surface-card)",
                                            color: RUBRIC_INFO[activeHighlight].accent,
                                            border: `1px solid ${RUBRIC_INFO[activeHighlight].border}`,
                                            fontFamily: "var(--font-mono)",
                                        }}
                                    >
                                        {roundIeltsScore(currentTaskData.rubrics[activeHighlight].band).toFixed(1)}
                                    </span>
                                </div>

                                {/* Flaws */}
                                <div
                                    className="mb-4 rounded-xl p-4"
                                    style={{ backgroundColor: "rgba(255,255,255,0.7)", border: "1px solid #fecaca" }}
                                >
                                    <h4
                                        className="font-bold mb-3 text-sm"
                                        style={{ color: "#7f1d1d", fontFamily: "var(--font-body)" }}
                                    >
                                        Lỗi cần khắc phục
                                    </h4>
                                    <ul className="space-y-2">
                                        {currentTaskData.rubrics[activeHighlight].feedback.flaws.map((flaw: string, i: number) => (
                                            <li key={i} className="text-sm leading-relaxed" style={{ color: "#991b1b" }}>
                                                • {flaw}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Improvements */}
                                <div
                                    className="rounded-xl p-4"
                                    style={{
                                        backgroundColor: "rgba(255,255,255,0.7)",
                                        border: "1px solid var(--color-border-default)",
                                    }}
                                >
                                    <h4
                                        className="font-bold mb-3 text-sm"
                                        style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-body)" }}
                                    >
                                        Hướng cải thiện
                                    </h4>
                                    <ul className="space-y-2 mb-4">
                                        {currentTaskData.rubrics[activeHighlight].feedback.improvements.map((imp: string, i: number) => (
                                            <li key={i} className="text-sm leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
                                                • {imp}
                                            </li>
                                        ))}
                                    </ul>
                                    {currentTaskData.rubrics[activeHighlight].feedback.example_rewrite && (
                                        <div
                                            className="p-3 rounded-lg mt-3"
                                            style={{
                                                backgroundColor: "var(--color-surface-card)",
                                                border: "1px solid var(--color-border-default)",
                                            }}
                                        >
                                            <span
                                                className="text-xs font-bold uppercase tracking-wide"
                                                style={{ color: "var(--color-text-muted)" }}
                                            >
                                                Ví dụ sửa lại:
                                            </span>
                                            <p
                                                className="text-sm font-medium italic mt-2"
                                                style={{ color: "var(--color-text-primary)" }}
                                            >
                                                &ldquo;{currentTaskData.rubrics[activeHighlight].feedback.example_rewrite}&rdquo;
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div
                                className="rounded-2xl p-10 text-center"
                                style={{
                                    backgroundColor: "var(--color-surface-subtle)",
                                    border: "1px dashed var(--color-border-default)",
                                }}
                            >
                                <div
                                    className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                                    style={{ backgroundColor: "var(--color-surface-muted)" }}
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        style={{ color: "var(--color-text-muted)" }}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                                    </svg>
                                </div>
                                <p className="font-medium" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-body)" }}>
                                    Chọn một tiêu chí để xem chi tiết
                                </p>
                                <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
                                    Hoặc click vào đoạn văn được tô màu bên trái.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
