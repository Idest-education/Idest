"use client";

import { use, useEffect, useState } from "react";
import { getListeningAssignment, getListeningSubmissionResult } from "@/services/assignment.service";
import { ListeningAssignmentDetail, SubmissionResultV2 } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";

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
                setAssignment(aRes.data);
                setResult(rRes.data);
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

    const section = assignment.sections[activeSectionIndex];
    const sectionResult = result.details[activeSectionIndex];

    // Convert raw correct answers to an IELTS-like band score (0.0–9.0)
    // Using proportional scaling to 9 and rounding to nearest 0.5.
    const totalQ = result.total_questions || 1;
    const rawBand = (result.correct_answers / totalQ) * 9;
    const bandScore = Math.max(0, Math.min(9, Math.round(rawBand * 2) / 2));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-1 px-1">
            <div className="flex h-screen border border-gray-300 mx-2 mt-9 mb-19">
                {/* LEFT - Audio Panel */}
                <div className="flex-1 flex flex-col border-r border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
                    <div className="p-6 overflow-y-auto">
                        {/* TABS (Recording 1..n) */}
                        <div className="flex gap-3 mb-3">
                            {assignment.sections.map((sec, idx) => (
                                <button
                                    key={sec.id}
                                    onClick={() => setActiveSectionIndex(idx)}
                                    className={`px-4 py-2 rounded-full border ${activeSectionIndex === idx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
                                        }`}
                                >
                                    Bài nghe {idx + 1}
                                </button>
                            ))}
                        </div>

                        <div className="mt-6">
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <p className="text-sm font-semibold text-gray-800 mb-3">
                                    {section.title ?? sectionResult?.section_title ?? `Bài nghe ${activeSectionIndex + 1}`}
                                </p>
                                <audio
                                    controls
                                    src={(section as any).material?.type === "listening" ? (section as any).material.audio?.url : ""}
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* TRANSCRIPT (show on result page) */}
                        {(section as any).material?.type === "listening" && (section as any).material.transcript_md && (
                            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
                                <p className="text-sm font-semibold text-gray-800 mb-2">Transcript</p>
                                <p className="whitespace-pre-line text-gray-700 leading-relaxed">
                                    {(section as any).material.transcript_md}
                                </p>
                            </div>
                        )}
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
                                {section.title ?? sectionResult?.section_title ?? `Bài nghe ${activeSectionIndex + 1}`}
                            </h3>
                        </div>

                        {/* Questions Review (v2) */}
                        <div className="space-y-6">
                            {sectionResult?.questions?.map((q) => (
                                <div key={q.question_id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                                        <p className="text-sm font-semibold text-gray-800">Question {q.question_id}</p>
                                        <span className={`text-xs font-semibold ${q.correct ? "text-green-700" : "text-red-700"}`}>
                                            {q.correct ? "Correct" : "Incorrect"}
                                        </span>
                                    </div>
                                    <div className="text-sm p-5 space-y-3">
                                        {(q.parts ?? []).map((p) => (
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
                                                        <div className="text-sm text-gray-800 break-words">{String(p.submitted_answer ?? "")}</div>
                                                    </div>
                                                    <div className="bg-green-50 rounded p-2 border border-green-200">
                                                        <div className="text-xs text-gray-500">Correct</div>
                                                        <div className="text-sm text-gray-800 break-words">{String(p.correct_answer ?? "")}</div>
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

function formatTextAnswer(value: unknown): string {
    if (value === undefined || value === null || value === "") return "(không trả lời)";
    return String(value);
}