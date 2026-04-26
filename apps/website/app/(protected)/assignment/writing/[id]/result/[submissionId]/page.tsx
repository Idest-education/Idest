"use client";

import { use, useEffect, useState } from "react";
import LoadingScreen from "@/components/loading-screen";
import { getWritingAssignment, getWritingSubmissionResult } from "@/services/assignment.service";
import { RubricDetail, WritingSubmissionResult, WritingSubmissionResponse } from "@/types/assignment";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

const RUBRIC_INFO = {
    task_achievement: { label: "Task Achievement (TA)", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    coherence: { label: "Coherence (CC)", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
    lexical: { label: "Lexical Resource (LR)", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
    grammar: { label: "Grammar (GR)", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
};

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
    if (!result) return <div className="text-center mt-20 text-gray-500">Không tìm thấy kết quả</div>;

    const overallRounded = roundIeltsScore(result.score || 0);
    const currentTaskData = result?.grading_breakdown?.tasks?.[activeTask];

    // --- HÀM TÌM NỘI DUNG THÔNG MINH ---
    // Sử dụng evidence_quote để định vị chính xác bài viết thuộc về Task nào (chống lỗi UUID ngẫu nhiên)
    const getTaskContent = (taskKey: "task1" | "task2") => {
        const contents = Object.values(result?.content_by_task_id || {});
        if (contents.length === 0) return "Không có nội dung bài viết.";
        if (contents.length === 1) return contents[0];

        const taskRubrics = result?.grading_breakdown?.tasks?.[taskKey]?.rubrics;
        const sampleQuote = Object.values(taskRubrics || {}).find(r => r?.feedback?.evidence_quote)?.feedback?.evidence_quote;

        if (sampleQuote) {
            const shortSample = sampleQuote.substring(0, 20); // Lấy 20 ký tự đầu để tìm cho chắc
            const matchedContent = contents.find(c => c.includes(shortSample));
            if (matchedContent) return matchedContent;
        }

        // Fallback: Nếu AI không có quote, dùng thứ tự mảng
        return contents[taskKey === 'task1' ? 0 : 1];
    };

    const currentContent = getTaskContent(activeTask);

    // --- COMPONENT HIGHLIGHT CẢI TIẾN V2 (Xử lý chồng chéo & Khớp chính xác) ---
    const HighlightedEssay = ({ content, rubrics }: { content: string, rubrics: Record<string, RubricDetail> }) => {
        if (!content) return null;

        const quotes: { quote: string, type: keyof typeof RUBRIC_INFO }[] = [];

        Object.entries(rubrics || {}).forEach(([key, detail]) => {
            if (detail?.feedback?.evidence_quote) {
                quotes.push({ quote: detail.feedback.evidence_quote, type: key as keyof typeof RUBRIC_INFO });
            }
        });

        // 1. Khởi tạo mảng dán nhãn (Set) cho từng ký tự trong bài viết
        const charTypes = Array.from({ length: content.length }, () => new Set<keyof typeof RUBRIC_INFO>());

        quotes.forEach(q => {
            let cleanQuote = q.quote.trim();
            if (!cleanQuote) return;

            // Dọn dẹp quote: Xóa ngoặc kép thừa của AI và dấu câu ở cuối
            cleanQuote = cleanQuote.replace(/^["']|["']$/g, "").trim();
            cleanQuote = cleanQuote.replace(/[.,:;!?]+$/, "");

            // Chuyển Quote thành Regex để bỏ qua các lỗi gõ sai khoảng trắng hoặc xuống dòng (\n)
            const escapedQuote = cleanQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regexStr = escapedQuote.replace(/\s+/g, '\\s+');

            try {
                const regex = new RegExp(regexStr, 'i'); // i: không phân biệt hoa/thường
                const match = content.match(regex);

                if (match && match.index !== undefined) {
                    const startIdx = match.index;
                    const matchLength = match[0].length;

                    // Gắn nhãn lỗi cho ĐÚNG các ký tự thuộc về quote này
                    for (let i = startIdx; i < startIdx + matchLength; i++) {
                        charTypes[i].add(q.type);
                    }
                }
            } catch (e) {
                console.error("Regex error for quote:", regexStr);
            }
        });

        // 2. Gom nhóm các ký tự đứng liền kề nhau có CÙNG danh sách lỗi
        const segments: { text: string, types: (keyof typeof RUBRIC_INFO)[] }[] = [];
        if (content.length > 0) {
            let currentText = content[0];
            let currentTypes = Array.from(charTypes[0]);

            for (let i = 1; i < content.length; i++) {
                const types = Array.from(charTypes[i]);
                const isSameTypes = types.length === currentTypes.length && types.every(t => currentTypes.includes(t));

                if (isSameTypes) {
                    currentText += content[i];
                } else {
                    segments.push({ text: currentText, types: currentTypes });
                    currentText = content[i];
                    currentTypes = types;
                }
            }
            segments.push({ text: currentText, types: currentTypes });
        }

        // 3. Render giao diện
        return (
            <div className="text-gray-800 leading-loose whitespace-pre-wrap font-serif text-lg">
                {segments.map((seg, idx) => {
                    // Nếu đoạn text không có lỗi -> Render chữ bình thường
                    if (seg.types.length === 0) {
                        return <span key={idx}>{seg.text}</span>;
                    }

                    // Nếu có lỗi, kiểm tra xem có đang được user focus không
                    const isActive = activeHighlight && seg.types.includes(activeHighlight);

                    const handleClick = () => {
                        if (isActive) {
                            // Xoay vòng các lỗi trùng nhau trên cùng 1 đoạn text
                            const currentIndex = seg.types.indexOf(activeHighlight!);
                            const nextType = seg.types[(currentIndex + 1) % seg.types.length];
                            setActiveHighlight(nextType);
                        } else {
                            setActiveHighlight(seg.types[0]);
                        }
                    };

                    return (
                        <span
                            key={idx}
                            onClick={handleClick}
                            className={`cursor-pointer transition-all ${isActive
                                ? 'bg-yellow-300 ring-2 ring-yellow-400 shadow-sm rounded-sm relative z-10 font-medium'
                                : 'bg-yellow-100 hover:bg-yellow-200 rounded-sm'
                                }`}
                            title={`Click để xem: ${seg.types.map(t => RUBRIC_INFO[t].label).join(' | ')}`}
                        >
                            {seg.text}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 1. ĐIỂM OVERALL CHUẨN IELTS */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                    <h1 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Điểm Tổng Thể (IELTS Standard)</h1>
                    <div className="inline-flex items-end justify-center gap-2">
                        <span className="text-8xl font-extrabold text-indigo-900 tracking-tighter">
                            {overallRounded.toFixed(1)}
                        </span>
                        <span className="text-3xl font-semibold text-gray-400 mb-2">/ 9.0</span>
                    </div>
                    <p className="mt-4 text-gray-500">
                        Điểm hệ thống: <span className="font-medium text-gray-700">{result.score?.toFixed(2)}</span>
                        <span className="mx-2">•</span>
                        Làm tròn: <span className="font-medium text-indigo-600">{overallRounded.toFixed(1)}</span>
                    </p>
                </div>

                {/* TAB CHUYỂN TASK */}
                <div className="flex gap-4 border-b border-gray-200">
                    <button
                        onClick={() => { setActiveTask("task1"); setActiveHighlight(null); }}
                        className={`pb-4 px-4 text-lg font-semibold transition-all ${activeTask === "task1" ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Task 1 (Điểm: {result?.grading_breakdown?.tasks?.task1?.band?.toFixed(1) || "-"})
                    </button>
                    <button
                        onClick={() => { setActiveTask("task2"); setActiveHighlight(null); }}
                        className={`pb-4 px-4 text-lg font-semibold transition-all ${activeTask === "task2" ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Task 2 (Điểm: {result?.grading_breakdown?.tasks?.task2?.band?.toFixed(1) || "-"})
                    </button>
                </div>

                <div className="space-y-8">
                    {/* 2. ĐIỂM THÀNH PHẦN (4 TIÊU CHÍ) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(Object.entries(RUBRIC_INFO) as [keyof typeof RUBRIC_INFO, any][]).map(([key, info]) => {
                            const rubricData = currentTaskData?.rubrics[key];
                            return (
                                <button
                                    key={key}
                                    onClick={() => setActiveHighlight(key)}
                                    className={`p-4 rounded-xl text-left transition-all border group ${activeHighlight === key ? `ring-2 ring-offset-2 ${info.bg} ${info.border}` : 'bg-white border-gray-100 hover:shadow-md'}`}
                                >
                                    <div className={`text-sm font-bold ${info.color} mb-1`}>{info.label}</div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-extrabold text-gray-800 group-hover:text-indigo-600 transition-colors">
                                            {rubricData?.band?.toFixed(1) || "-"}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2">Click xem chi tiết & lỗi</div>
                                </button>
                            );
                        })}
                    </div>

                    {/* 3. BÀI VIẾT HIGHLIGHT & GIẢI THÍCH CHI TIẾT */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                        {/* Cột trái: Bài viết */}
                        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                            <h3 className="text-xl font-bold text-gray-800 mb-6 flex justify-between items-center border-b pb-4">
                                <span>Bài làm của bạn</span>
                                <span className="text-sm font-medium text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
                                    💡 Click vào đoạn bôi vàng để xem lỗi
                                </span>
                            </h3>
                            <HighlightedEssay
                                content={currentContent}
                                rubrics={currentTaskData?.rubrics || {}}
                            />
                        </div>

                        {/* Cột phải: Chi tiết lỗi / Phản hồi */}
                        <div className="lg:col-span-2 space-y-4">
                            {activeHighlight && currentTaskData?.rubrics?.[activeHighlight]?.feedback ? (
                                <div className={`rounded-2xl p-6 border shadow-sm ${RUBRIC_INFO[activeHighlight].bg} ${RUBRIC_INFO[activeHighlight].border} sticky top-6`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <h3 className={`text-xl font-bold ${RUBRIC_INFO[activeHighlight].color}`}>
                                            {RUBRIC_INFO[activeHighlight].label}
                                        </h3>
                                        <span className={`px-3 py-1 rounded-lg font-bold text-lg bg-white border ${RUBRIC_INFO[activeHighlight].color} ${RUBRIC_INFO[activeHighlight].border}`}>
                                            {currentTaskData.rubrics[activeHighlight].band.toFixed(1)}
                                        </span>
                                    </div>

                                    {/* Lỗi (Flaws) */}
                                    <div className="mb-6 bg-white/60 p-4 rounded-xl border border-red-100">
                                        <h4 className="text-red-700 font-bold mb-3 flex items-center gap-2">
                                            <span className="bg-red-100 p-1 rounded">✕</span> Lỗi cần khắc phục
                                        </h4>
                                        <ul className="space-y-3">
                                            {currentTaskData.rubrics[activeHighlight].feedback.flaws.map((flaw: string, i: number) => (
                                                <li key={i} className="text-sm text-red-900 leading-relaxed">• {flaw}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Hướng cải thiện */}
                                    <div className="mb-4 bg-white/60 p-4 rounded-xl border border-blue-100">
                                        <h4 className="text-blue-700 font-bold mb-3 flex items-center gap-2">
                                            <span className="bg-blue-100 p-1 rounded">→</span> Hướng cải thiện
                                        </h4>
                                        <ul className="space-y-3 mb-4">
                                            {currentTaskData.rubrics[activeHighlight].feedback.improvements.map((imp: string, i: number) => (
                                                <li key={i} className="text-sm text-blue-900 leading-relaxed">• {imp}</li>
                                            ))}
                                        </ul>

                                        {currentTaskData.rubrics[activeHighlight].feedback.example_rewrite && (
                                            <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm mt-4">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ví dụ sửa lại:</span>
                                                <p className="text-sm text-gray-800 font-medium italic mt-2">
                                                    "{currentTaskData.rubrics[activeHighlight].feedback.example_rewrite}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200 text-center text-gray-500 sticky top-6 shadow-sm">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                        </svg>
                                    </div>
                                    <p className="font-medium text-gray-600">Hãy chọn một tiêu chí (TA, CC, LR, GR)</p>
                                    <p className="text-sm mt-2">Hoặc click vào đoạn văn bôi vàng bên trái để xem giải thích chi tiết.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}