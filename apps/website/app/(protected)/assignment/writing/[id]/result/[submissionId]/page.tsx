"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { getWritingAssignment, getWritingSubmissionResult } from "@/services/assignment.service";
import LoadingScreen from "@/components/loading-screen";
import type { WritingAssignmentDetail, WritingSubmissionResult } from "@/types/assignment";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

export default function WritingResultPage(props: Props) {
    const { id, submissionId } = use(props.params);
    const [result, setResult] = useState<WritingSubmissionResult | null>(null);
    const [assignment, setAssignment] = useState<WritingAssignmentDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [aRes, sRes] = await Promise.all([
                    getWritingAssignment(id),
                    getWritingSubmissionResult(submissionId),
                ]);
                setAssignment(aRes.data);
                setResult(sRes.data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id, submissionId]);

    if (loading) {
        return <LoadingScreen />;
    }

    if (!result) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <p className="text-xl font-semibold text-gray-800">Không tìm thấy kết quả</p>
                </div>
            </div>
        );
    }

    const getBandColor = (score: number) => {
        if (score >= 8) return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", bar: "bg-emerald-500" };
        if (score >= 7) return { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", bar: "bg-blue-500" };
        if (score >= 6) return { text: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-300", bar: "bg-cyan-500" };
        if (score >= 5) return { text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300", bar: "bg-yellow-500" };
        return { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", bar: "bg-orange-500" };
    };

    const isPending = result.status === "pending" || typeof result.score !== "number";
    const colors = getBandColor(typeof result.score === "number" ? result.score : 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-semibold mb-2">
                        KẾT QUẢ BÀI VIẾT IELTS
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900">Kết Quả Bài Viết</h1>
                    <p className="text-gray-600 text-lg">Đánh giá theo tiêu chuẩn IELTS Band Score</p>
                </div>

                {isPending ? (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
                        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-8 py-6">
                            <h2 className="text-2xl font-bold text-white">Trạng thái</h2>
                            <p className="text-indigo-100 text-sm mt-2">Bài viết của bạn đang được hệ thống chấm điểm.</p>
                        </div>
                        <div className="px-8 py-8 bg-gradient-to-b from-white to-gray-50">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                Đang chấm điểm
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Band Score Card */}
                        <div className={`${colors.bg} border-2 ${colors.border} rounded-2xl p-5 shadow-xl`}>
                            <div className="text-center space-y-6">
                                <div className="space-y-2">
                                    <p className="text-gray-600 font-medium text-sm uppercase tracking-wider">Điểm tổng thể</p>
                                    <div className="flex items-baseline justify-center gap-2">
                                        <span className={`text-8xl font-bold ${colors.text}`}>
                                            {result.score}
                                        </span>
                                        <span className="text-5xl font-semibold text-gray-400">/9.0</span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="max-w-md mx-auto">
                                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                                        <div
                                            className={`h-full ${colors.bar} transition-all duration-1000 rounded-full`}
                                            style={{ width: `${((result.score ?? 0) / 9) * 100}%` }}
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
                                    Nhận xét của giám khảo
                                </h2>
                                <p className="text-indigo-100 text-sm mt-2">Nhận xét chi tiết từ hệ thống chấm bài</p>
                            </div>
                            <div className="px-8 py-8 bg-gradient-to-b from-white to-gray-50">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-1 h-full bg-indigo-500 rounded-full flex-shrink-0 mt-1"></div>
                                        <p className="whitespace-pre-line text-gray-700 leading-relaxed text-base">
                                            {result.feedback}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Question (always show if available) */}
                {assignment && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
                        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-8 py-6">
                            <h2 className="text-2xl font-bold text-white">Đề bài</h2>
                            <p className="text-indigo-100 text-sm mt-2">Nội dung Task 1 & Task 2</p>
                        </div>
                        <div className="px-8 py-8 space-y-6 bg-gradient-to-b from-white to-gray-50">
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Task 1</h3>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 whitespace-pre-wrap text-gray-800 leading-relaxed">
                                    {assignment.taskone}
                                </div>
                                {assignment.img && (
                                    <div className="mt-4">
                                        <Image
                                            src={assignment.img}
                                            alt="Task 1 image"
                                            width={1200}
                                            height={800}
                                            className="rounded-xl border border-gray-200 w-full h-auto"
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Task 2</h3>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 whitespace-pre-wrap text-gray-800 leading-relaxed">
                                    {assignment.tasktwo}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* My submission (always show) */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-6">
                        <h2 className="text-2xl font-bold text-white">Bài bạn đã nộp</h2>
                        <p className="text-slate-200 text-sm mt-2">Nội dung bài viết của bạn (Task 1 & Task 2)</p>
                    </div>
                    <div className="px-8 py-8 space-y-6">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Task 1</h3>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 whitespace-pre-wrap text-gray-800 leading-relaxed">
                                {result.contentOne}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Task 2</h3>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 whitespace-pre-wrap text-gray-800 leading-relaxed">
                                {result.contentTwo}
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
                        Tham khảo thang điểm IELTS
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                        <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                            <span className="font-bold text-emerald-700">8.0-9.0</span>
                            <p className="text-gray-600 mt-1">Người dùng chuyên nghiệp</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded border border-blue-200">
                            <span className="font-bold text-blue-700">7.0-7.5</span>
                            <p className="text-gray-600 mt-1">Người dùng tốt</p>
                        </div>
                        <div className="p-2 bg-cyan-50 rounded border border-cyan-200">
                            <span className="font-bold text-cyan-700">6.0-6.5</span>
                            <p className="text-gray-600 mt-1">Người dùng thành thạo</p>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                            <span className="font-bold text-yellow-700">5.0-5.5</span>
                            <p className="text-gray-600 mt-1">Người dùng trung bình</p>
                        </div>
                        <div className="p-2 bg-orange-50 rounded border border-orange-200">
                            <span className="font-bold text-orange-700">0-4.5</span>
                            <p className="text-gray-600 mt-1">Người dùng hạn chế</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
