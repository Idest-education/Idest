"use client";

import { use, useEffect, useState } from "react";
import { getSpeakingAssignment, getSpeakingSubmissionResult } from "@/services/assignment.service";
import { SpeakingAssignmentDetail, SpeakingSubmissionResult } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

export default function SpeakingResultPage(props: Props) {
    const { id, submissionId } = use(props.params);

    const [result, setResult] = useState<SpeakingSubmissionResult | null>(null);
    const [assignment, setAssignment] = useState<SpeakingAssignmentDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [aRes, sRes] = await Promise.all([
                    getSpeakingAssignment(id),
                    getSpeakingSubmissionResult(submissionId),
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

    const getScoreColor = (score: number) => {
        if (score >= 8) return "text-green-600";
        if (score >= 6.5) return "text-blue-600";
        if (score >= 5) return "text-yellow-600";
        return "text-red-600";
    };

    const getScoreBgColor = (score: number) => {
        if (score >= 8) return "from-green-50 to-emerald-50";
        if (score >= 6.5) return "from-blue-50 to-indigo-50";
        if (score >= 5) return "from-yellow-50 to-amber-50";
        return "from-red-50 to-rose-50";
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-3">
                    <div className="inline-block bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-2 rounded-full text-sm font-bold mb-4">
                        KẾT QUẢ BÀI THI NÓI IELTS
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Kết Quả Bài Thi</h1>
                    <p className="text-gray-600">Đánh giá chi tiết kỹ năng Speaking của bạn</p>
                </div>

                {result.status === "pending" || typeof result.score !== "number" ? (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-200 mb-6">
                        <div className="bg-gradient-to-r from-red-600 to-blue-600 px-6 py-4">
                            <h2 className="text-2xl font-bold text-white">Trạng thái</h2>
                            <p className="text-white/80 text-sm mt-1">Bài nói của bạn đang được hệ thống chấm điểm.</p>
                        </div>
                        <div className="p-8">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                Đang chấm điểm
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Score Card */}
                        <div className={`bg-gradient-to-br ${getScoreBgColor(result.score)} rounded-2xl shadow-2xl p-8 mb-6 border-2 border-gray-200`}>
                            <div className="text-center">
                                <p className="text-lg font-medium text-gray-700 mb-3">Điểm số</p>
                                <div className="relative inline-block">
                                    <div className="absolute inset-0 bg-white rounded-full blur-xl opacity-50"></div>
                                    <div className={`relative text-7xl font-black ${getScoreColor(result.score)} bg-white rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-lg border-4 ${getScoreColor(result.score).replace('text-', 'border-')}`}>
                                        {result.score}
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-4 font-medium">
                                    {result.score >= 8 && "🎉 Xuất sắc! Người dùng rất tốt"}
                                    {result.score >= 6.5 && result.score < 8 && "👏 Tốt! Người dùng thành thạo"}
                                    {result.score >= 5 && result.score < 6.5 && "💪 Khá! Người dùng trung bình"}
                                    {result.score < 5 && "📚 Cần cải thiện! Người dùng hạn chế"}
                                </p>
                            </div>
                        </div>

                        {/* Feedback Card */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-200">
                            <div className="bg-gradient-to-r from-red-600 to-blue-600 px-6 py-4">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <span>📝</span>
                                    Nhận Xét Chi Tiết
                                </h2>
                            </div>
                            <div className="p-8">
                                <div className="prose prose-lg max-w-none">
                                    <p className="whitespace-pre-line leading-relaxed text-gray-700 text-base">
                                        {result.feedback}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Question (always show if available) */}
                {assignment && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-200 mt-6">
                        <div className="bg-gradient-to-r from-red-600 to-blue-600 px-6 py-4">
                            <h2 className="text-2xl font-bold text-white">Đề bài</h2>
                            <p className="text-white/80 text-sm mt-1">Câu hỏi Speaking Parts 1–3</p>
                        </div>
                        <div className="p-8 space-y-6">
                            {assignment.parts?.map((part) => (
                                <div key={part.part_number} className="space-y-2">
                                    <h3 className="font-semibold text-gray-900">Phần {part.part_number}</h3>
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                                        {part.questions.map((q) => (
                                            <div key={q.id} className="text-gray-800">
                                                • {q.prompt}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* My audio (always show) */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-200 mt-6">
                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4">
                        <h2 className="text-2xl font-bold text-white">Bài nói bạn đã nộp</h2>
                        <p className="text-white/80 text-sm mt-1">Nghe lại bản ghi âm của bạn</p>
                    </div>
                    <div className="p-8 space-y-6">
                        {result.audio_url ? (
                            <audio controls src={result.audio_url} className="w-full" />
                        ) : (
                            <div className="text-gray-600">Không tìm thấy audio để phát.</div>
                        )}

                        {(result.transcriptOne || result.transcriptTwo || result.transcriptThree) && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-900">Transcript (nếu có)</h3>
                                {result.transcriptOne && (
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 mb-1">Part 1</div>
                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 whitespace-pre-wrap text-gray-800">
                                            {result.transcriptOne}
                                        </div>
                                    </div>
                                )}
                                {result.transcriptTwo && (
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 mb-1">Part 2</div>
                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 whitespace-pre-wrap text-gray-800">
                                            {result.transcriptTwo}
                                        </div>
                                    </div>
                                )}
                                {result.transcriptThree && (
                                    <div>
                                        <div className="text-sm font-medium text-gray-700 mb-1">Part 3</div>
                                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 whitespace-pre-wrap text-gray-800">
                                            {result.transcriptThree}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-2 bg-white rounded-full px-6 py-3 shadow-md border border-gray-200">
                        <span className="text-sm text-gray-600">
                            💡 Lưu ý: Điểm IELTS Speaking được đánh giá theo 4 tiêu chí: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}