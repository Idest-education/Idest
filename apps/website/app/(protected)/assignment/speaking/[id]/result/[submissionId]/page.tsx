"use client";

import { use, useEffect, useState } from "react";
import { getSpeakingSubmissionResult } from "@/services/assignment.service";
import { SpeakingSubmissionResult } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

export default function SpeakingResultPage(props: Props) {
    const { submissionId } = use(props.params);

    const [result, setResult] = useState<SpeakingSubmissionResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await getSpeakingSubmissionResult(submissionId);
                setResult(res.data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [submissionId]);

    if (loading) {
        <LoadingScreen />;
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