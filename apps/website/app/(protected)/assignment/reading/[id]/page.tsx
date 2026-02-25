"use client";

import { useEffect, useState } from "react";
import { getReadingAssignment } from "@/services/assignment.service";
import { submitReading } from "@/services/assignment.service";
import PassageTabs from "@/components/assignment/passagetabs";
import PassageContent from "@/components/assignment/passage-content";
import QuestionRenderer from "@/components/assignment/v2/QuestionRenderer";
import MarkdownRenderer from "@/components/conversation/MarkdownRenderer";
import SidebarNavigation from "@/components/assignment/SidebarNavigation";
import { ReadingAssignmentDetail, SectionV2Client } from "@/types/assignment";
import { use } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/loading-screen";
import { createClient } from "@/lib/supabase/client";

interface ReadingAssignmentPageProps {
    params: Promise<{ id: string }>;
}

export default function ReadingAssignmentPage(props: ReadingAssignmentPageProps) {
    const { id } = use(props.params);
    const router = useRouter();
    const [loading, setLoading] = useState<boolean>(true);
    const [assignment, setAssignment] = useState<ReadingAssignmentDetail | null>(null);
    const [activePassage, setActivePassage] = useState<number>(0);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const [, setCurrentQuestionIndex] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await getReadingAssignment(id);
                setAssignment(res.data);
            } catch (err) {
                console.error("Reading error:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [id]);

    async function handleSubmit(): Promise<void> {
        if (!assignment || submitting) return;

        try {
            setSubmitting(true);
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id || localStorage.getItem("user_id");
            
            if (!userId) {
                alert("Bạn chưa đăng nhập. Vui lòng đăng nhập lại.");
                return;
            }
            
            // Use the ID from URL params first, then fallback to assignment object
            const assignmentId = id || assignment.id || assignment._id;
            if (!assignmentId) {
                console.error("Missing assignment ID on assignment payload", assignment);
                alert("Không xác định được mã bài đọc. Vui lòng tải lại trang.");
                return;
            }
            const payload = {
                assignment_id: assignmentId,
                submitted_by: userId!,
                section_answers: assignment.sections.map((section) => ({
                    section_id: section.id,
                    answers: (section.question_groups ?? []).flatMap((g) =>
                        g.questions.map((q) => ({
                            question_id: q.id,
                            answer: answers[q.id] ?? {},
                        })),
                    ),
                })),
            };

            const res = await submitReading(payload);
            router.push(`/assignment/reading/${assignmentId}/result/${res.data.id}`);
        } catch (err) {
            console.error("Submit failed:", err);
            alert("Nộp bài thất bại. Vui lòng thử lại.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading || submitting) {
        return <LoadingScreen />;
    }

    if (!assignment) {
        return (
            <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 to-orange-50">
                <div className="text-center space-y-3 p-8 bg-white rounded-2xl shadow-lg">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <p className="text-xl font-semibold text-gray-800">Không tìm thấy bài tập</p>
                </div>
            </div>
        );
    }

    const sections = assignment.sections as SectionV2Client[];
    const currentSection = sections[activePassage];

    return (
        <div className="flex w-full h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* LEFT GROUP — Passage + Questions */}
            <div className="flex flex-1 mb-20 mt-10 ml-3">

                {/* LEFT - Passage Panel */}
                <div className="flex-1 flex flex-col border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm rounded-l-2xl transition-all duration-300 hover:rounded-r-3x">
                    <div className="p-4 overflow-y-auto">
                        <PassageTabs
                            sections={sections}
                            active={activePassage}
                            setActive={setActivePassage}
                        />
                        <div className="mt-6">
                            <PassageContent section={currentSection} />
                        </div>
                    </div>
                </div>

                {/* MIDDLE - Questions Panel */}
                <div className="w-[45%] flex border border-gray-300 flex-col bg-white/80 backdrop-blur-sm shadow-sm rounded-r-2xl transition-all duration-300 hover:rounded-r-3x">
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="space-y-6">
                            {(currentSection.question_groups ?? []).map((group) => {
                                return (
                                    <div key={group.id} className="space-y-4">
                                        {/* Group Title */}
                                        {group.title && (
                                            <div className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2">
                                                {group.title}
                                            </div>
                                        )}
                                        
                                        {/* Group Instructions */}
                                        {group.instructions_md && (
                                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                                <MarkdownRenderer content={group.instructions_md} className="text-sm text-gray-800" />
                                            </div>
                                        )}
                                        
                                        {/* Questions in this group */}
                                        {group.questions.map((q) => {
                                            return (
                                                <div key={q.id}>
                                                    <QuestionRenderer
                                                        question={q}
                                                        indexLabel={`Câu hỏi ${q.order_index}`}
                                                        answers={answers}
                                                        onChange={(questionId, answer) => setAnswers((prev) => ({ ...prev, [questionId]: answer }))}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-gray-200 bg-white/90 backdrop-blur-md px-6 py-4 rounded-br-2xl transition-all duration-300 hover:rounded-r-3x">
                        {activePassage < sections.length - 1 && (
                            <button
                                onClick={() => setActivePassage((prev) => prev + 1)}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <span>Tiếp theo</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT - Navigation Sidebar */}
            <div className="mb-10 mt-10 ml-3 mr-3">
                <SidebarNavigation
                    assignment={assignment}
                    activePassage={activePassage}
                    answers={answers}
                    setActivePassage={setActivePassage}
                    setCurrentQuestionIndex={setCurrentQuestionIndex}
                    onSubmit={handleSubmit}
                    onExit={() => router.push("/assignment")}
                />
            </div>
        </div>
    );
}