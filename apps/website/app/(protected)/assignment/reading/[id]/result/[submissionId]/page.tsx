"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import {
    ReadingAssignmentDetail,
    ReadingSubmissionResult,
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
    const [result, setResult] = useState<ReadingSubmissionResult | null>(null);
    const [activePassage, setActivePassage] = useState<number>(0);
    const [loading, setLoading] = useState(true);

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

    const section = assignment.sections[activePassage];
    const sectionResult = result.details[activePassage];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-1 px-1">
            <div className="flex h-screen border border-gray-300 mx-2 mt-9 mb-19">
                {/* LEFT - Passage Panel */}
                <div className="flex-1 flex flex-col border-r border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
                    <div className="p-6 overflow-y-auto">
                        <PassageTabs
                            sections={assignment.sections}
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
                                        {result.score}
                                        <span className="text-sm opacity-80">/{result.total_questions}</span>
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

                        {/* Questions Review */}
                        <div className="space-y-6">
                            {section.questions.map((q, qIndex) => {
                                const qResult = sectionResult.questions[qIndex];

                                return (
                                    <div key={q.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-4 border-b border-gray-200">
                                            <p className="text-sm font-semibold text-gray-800">{q.prompt}</p>
                                        </div>

                                        <div className="text-sm p-5 space-y-4">
                                            {q.subquestions.map((sub, sIndex) => {
                                                const subResult = qResult.subquestions[sIndex];
                                                const isCorrect = subResult.correct;

                                                return (
                                                    <div
                                                        key={sub.id}
                                                        className={`rounded-xl border-2 p-4 transition-all duration-200 ${isCorrect
                                                            ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300"
                                                            : "bg-gradient-to-br from-red-50 to-rose-50 border-red-300"
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isCorrect ? "bg-green-500" : "bg-red-500"
                                                                }`}>
                                                                {isCorrect ? (
                                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm text-gray-800 font-medium mb-3">{sub.subprompt}</p>

                                                                <div className="space-y-2">
                                                                    <div className={`rounded-lg p-3 ${isCorrect ? "bg-white/50" : "bg-white/60"
                                                                        }`}>
                                                                        <p className="text-sm text-gray-600 mb-1">Trả lời của bạn:</p>
                                                                        <p className={`font-semibold ${isCorrect ? "text-green-700" : "text-red-700"
                                                                            }`}>
                                                                            {convertAnswer(subResult.submitted_answer)}
                                                                        </p>
                                                                    </div>

                                                                    {!isCorrect && (
                                                                        <div className="rounded-lg p-3 bg-green-100/60 border border-green-300">
                                                                            <p className="text-sm text-gray-600 mb-1">Đáp án đúng:</p>
                                                                            <p className="text-sm font-semibold text-green-700">
                                                                                {convertAnswer(subResult.correct_answer)}
                                                                            </p>
                                                                        </div>
                                                                    )}
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

function convertAnswer(value: string | number | undefined): string {
    if (value === undefined || value === null || value === "") return "(không trả lời)";
    if (typeof value === "string") return value;
    return String.fromCharCode(65 + value);
}