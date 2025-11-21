"use client";

import { use, useEffect, useState } from "react";
import { getWritingSubmissionResult } from "@/services/assignment.service";
import LoadingScreen from "@/components/loading-screen";
import type { WritingSubmissionResult } from "@/types/assignment";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

export default function WritingResultPage(props: Props) {
    const { submissionId } = use(props.params);
    const [result, setResult] = useState<WritingSubmissionResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await getWritingSubmissionResult(submissionId);
                setResult(res.data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [submissionId]);

    if (loading) {
        return <LoadingScreen />;
    }

    const getBandColor = (score: number) => {
        if (score >= 8) return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", bar: "bg-emerald-500" };
        if (score >= 7) return { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", bar: "bg-blue-500" };
        if (score >= 6) return { text: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-300", bar: "bg-cyan-500" };
        if (score >= 5) return { text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300", bar: "bg-yellow-500" };
        return { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", bar: "bg-orange-500" };
    };

    const colors = getBandColor(result!.score);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-semibold mb-2">
                        IELTS WRITING RESULT
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900">Kết Quả Bài Viết</h1>
                    <p className="text-gray-600 text-lg">Đánh giá theo tiêu chuẩn IELTS Band Score</p>
                </div>

                {/* Band Score Card */}
                <div className={`${colors.bg} border-2 ${colors.border} rounded-2xl p-5 shadow-xl`}>
                    <div className="text-center space-y-6">
                        <div className="space-y-2">
                            <p className="text-gray-600 font-medium text-sm uppercase tracking-wider">Overall Band Score</p>
                            <div className="flex items-baseline justify-center gap-2">
                                <span className={`text-8xl font-bold ${colors.text}`}>
                                    {result!.score}
                                </span>
                                <span className="text-5xl font-semibold text-gray-400">/9.0</span>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="max-w-md mx-auto">
                            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                                <div
                                    className={`h-full ${colors.bar} transition-all duration-1000 rounded-full`}
                                    style={{ width: `${(result!.score / 9) * 100}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                                <span>0</span>
                                <span>3</span>
                                <span>5</span>
                                <span>7</span>
                                <span>9</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Feedback Section */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
                    <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-8 py-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Examiner&apos;s Feedback
                        </h2>
                        <p className="text-indigo-100 text-sm mt-2">Nhận xét chi tiết từ hệ thống chấm bài</p>
                    </div>
                    <div className="px-8 py-8 bg-gradient-to-b from-white to-gray-50">
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-1 h-full bg-indigo-500 rounded-full flex-shrink-0 mt-1"></div>
                                <p className="whitespace-pre-line text-gray-700 leading-relaxed text-base">
                                    {result!.feedback}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* IELTS Band Descriptor Reference */}
                <div className="bg-white/80 backdrop-blur rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        IELTS Band Score Reference
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                        <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                            <span className="font-bold text-emerald-700">8.0-9.0</span>
                            <p className="text-gray-600 mt-1">Expert User</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded border border-blue-200">
                            <span className="font-bold text-blue-700">7.0-7.5</span>
                            <p className="text-gray-600 mt-1">Good User</p>
                        </div>
                        <div className="p-2 bg-cyan-50 rounded border border-cyan-200">
                            <span className="font-bold text-cyan-700">6.0-6.5</span>
                            <p className="text-gray-600 mt-1">Competent</p>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                            <span className="font-bold text-yellow-700">5.0-5.5</span>
                            <p className="text-gray-600 mt-1">Modest User</p>
                        </div>
                        <div className="p-2 bg-orange-50 rounded border border-orange-200">
                            <span className="font-bold text-orange-700">0-4.5</span>
                            <p className="text-gray-600 mt-1">Limited User</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
