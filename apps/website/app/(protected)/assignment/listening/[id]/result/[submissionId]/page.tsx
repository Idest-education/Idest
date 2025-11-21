"use client";

import { use, useEffect, useState } from "react";
import { getListeningSubmissionResult } from "@/services/assignment.service";
import { ListeningSubmissionResult } from "@/types/assignment";
import LoadingScreen from "@/components/loading-screen";

interface Props {
    params: Promise<{ id: string; submissionId: string }>;
}

export default function ListeningResultPage(props: Props) {
    const { submissionId } = use(props.params);

    const [result, setResult] = useState<ListeningSubmissionResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const res = await getListeningSubmissionResult(submissionId);
                setResult(res.data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [submissionId]);

    if (loading) return <LoadingScreen />;

    if (!result) return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="bg-white p-8 rounded-xl shadow-lg">
                <p className="text-gray-600 text-lg">No result found</p>
            </div>
        </div>
    );

    let globalIndex = 1;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-6 px-4">
            <div className="max-w-5xl mx-auto">
                {/* HEADER */}
                <div className="text-center mb-8">
                    <div className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-semibold mb-4">
                        IELTS LISTENING TEST
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Your Test Results
                    </h1>
                    <p className="text-gray-600">Review your performance and answers</p>
                </div>

                {/* SCORE CARD */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl shadow-2xl p-8 mb-10 text-white">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-32 h-32 bg-white rounded-full mb-4">
                            <div className="text-center">
                                <div className="text-5xl font-bold text-indigo-600">{result.score}</div>
                                <div className="text-sm text-gray-600 font-medium">out of 10</div>
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold">Band Score</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
                            <div className="text-3xl font-bold mb-1">{result.correct_answers}</div>
                            <div className="text-sm opacity-90">Correct Answers</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
                            <div className="text-3xl font-bold mb-1">{result.incorrect_answers}</div>
                            <div className="text-sm opacity-90">Incorrect Answers</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/20">
                            <div className="text-3xl font-bold mb-1">{result.percentage}%</div>
                            <div className="text-sm opacity-90">Accuracy Rate</div>
                        </div>
                    </div>
                </div>

                {/* SECTIONS */}
                <div className="space-y-8">
                    {result.details.map((section, sIdx) => (
                        <div key={section.section_id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-4">
                                <h2 className="text-2xl font-bold text-white flex items-center">
                                    <span className="bg-white/20 rounded-lg px-3 py-1 text-lg mr-3">
                                        Section {sIdx + 1}
                                    </span>
                                    {section.section_title}
                                </h2>
                            </div>

                            <div className="p-6 space-y-4">
                                {section.questions.map((q) =>
                                    q.subquestions.map((sub) => {
                                        const isCorrect = sub.correct;
                                        const currentIndex = globalIndex++;

                                        return (
                                            <div
                                                key={sub.id}
                                                className={`rounded-xl border-2 p-5 transition-all hover:shadow-md ${isCorrect
                                                    ? "bg-green-50 border-green-400"
                                                    : "bg-red-50 border-red-400"
                                                    }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${isCorrect ? "bg-green-500" : "bg-red-500"
                                                        }`}>
                                                        {isCorrect ? "✓" : "✗"}
                                                    </div>

                                                    <div className="flex-1">
                                                        <p className="font-bold text-gray-800 mb-3 text-lg">
                                                            Question {currentIndex}
                                                        </p>

                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-600 font-medium min-w-[120px]">Your answer:</span>
                                                                <span className={`font-bold px-3 py-1 rounded-lg ${isCorrect
                                                                    ? "text-green-700 bg-green-100"
                                                                    : "text-red-700 bg-red-100"
                                                                    }`}>
                                                                    {sub.submitted_answer || "No answer"}
                                                                </span>
                                                            </div>

                                                            {!isCorrect && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-600 font-medium min-w-[120px]">Correct answer:</span>
                                                                    <span className="font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-lg">
                                                                        {sub.correct_answer}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}