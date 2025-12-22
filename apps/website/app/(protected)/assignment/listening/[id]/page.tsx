"use client";

import { use, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getListeningAssignment, submitListening } from "@/services/assignment.service";
import {
    ListeningAssignmentDetail,
} from "@/types/assignment";
import SidebarListening from "@/components/assignment/SidebarListening";
import MarkdownRenderer from "@/components/conversation/MarkdownRenderer";
import StimulusRenderer from "@/components/assignment/v2/StimulusRenderer";
import InteractionRenderer from "@/components/assignment/v2/InteractionRenderer";
import LoadingScreen from "@/components/loading-screen";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
    params: Promise<{ id: string }>;
}

export default function ListeningAssignmentPage(props: Props) {
    const { id } = use(props.params);
    const router = useRouter();

    const [assignment, setAssignment] = useState<ListeningAssignmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, unknown>>({});
    const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [currentSubIndex, setCurrentSubIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const res = await getListeningAssignment(id);
                setAssignment(res.data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    const flatSubquestions = useMemo(() => {
        const sections = assignment?.sections ?? [];
        const flat = sections.flatMap((sec, secIndex) =>
            (sec.question_groups ?? []).flatMap((g) =>
                g.questions.map((q, qIndex) => ({
                    globalIndex: 0,
                    sectionIndex: secIndex,
                    questionId: q.id,
                    questionIndex: qIndex,
                })),
            ),
        );
        flat.forEach((x, idx) => {
            x.globalIndex = idx + 1;
        });
        return flat;
    }, [assignment]);

    const activeSection = assignment?.sections?.[activeSectionIndex];

    // Scroll to selected question when jumping from sidebar
    useEffect(() => {
        const el = questionRefs.current[currentSubIndex];
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [currentSubIndex, activeSectionIndex]);

    const jumpToSection = useCallback(
        (nextIndex: number) => {
            setActiveSectionIndex(nextIndex);
            setCurrentSubIndex(() => {
                const first = flatSubquestions.find((x) => x.sectionIndex === nextIndex);
                return first ? first.globalIndex - 1 : 0;
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
        },
        [flatSubquestions]
    );

    function updateAnswer(questionId: string, value: unknown) {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }

    async function handleSubmit() {
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

            const payload = {
                assignment_id: assignment.id,
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

            const res = await submitListening(payload);
            const submissionId = res.data.id;
            router.push(`/assignment/listening/${assignment.id}/result/${submissionId}`);
        } catch (err) {
            console.error("Submit failed:", err);
            alert("Nộp bài thất bại. Vui lòng thử lại.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading || submitting) return <LoadingScreen />;
    if (!assignment || !activeSection) return <LoadingScreen />;

    return (
        <div className="flex w-full h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* MAIN CONTENT AREA */}
            <div className="flex flex-1 flex-col mb-20 mt-10 ml-3">
                {/* STICKY TOP BAR - Audio Player */}
                <div className="sticky top-0 z-10 border border-gray-300 bg-white/95 backdrop-blur-md shadow-sm rounded-t-2xl">
                    <div className="p-4">
                        {/* TABS */}
                        <div className="flex gap-4 mb-4">
                            {assignment!.sections.map((sec, i) => (
                                <button
                                    key={sec.id}
                                    onClick={() => jumpToSection(i)}
                                    className={`px-4 py-2 rounded-full border transition-all ${i === activeSectionIndex
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                                        }`}
                                >
                                    Recording {i + 1}
                                </button>
                            ))}
                        </div>

                        {/* AUDIO PLAYER */}
                        {activeSection.material.type === "listening" && (
                            <audio
                                controls
                                src={activeSection.material.audio.url}
                                className="w-full"
                            />
                        )}
                    </div>
                </div>

                {/* QUESTIONS AND ANSWERS PANEL - Split layout */}
                <div className="flex-1 flex border-x border-b border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm rounded-b-2xl overflow-hidden">
                    <div className="flex-1 flex overflow-hidden">
                        {/* LEFT: Instructions Only */}
                        <div className="w-1/2 border-r border-gray-300 overflow-y-auto bg-gray-50/30">
                            <div className="p-6 space-y-8">
                                {(activeSection.question_groups ?? []).map((group) => {
                                    return (
                                        <div key={group.id} className="pb-6 border-b-2 border-gray-200 last:border-b-0">
                                            {/* Group Instructions */}
                                            {group.instructions_md ? (
                                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                                    <MarkdownRenderer content={group.instructions_md} className="text-sm text-gray-800" />
                                                </div>
                                            ) : (
                                                <div className="h-4" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* RIGHT: Everything Else (Titles, Questions, Prompts, Stimulus, Answers) */}
                        <div className="w-1/2 flex flex-col overflow-hidden">
                            {/* Scrollable content area */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="p-6 space-y-8">
                                    {(activeSection.question_groups ?? []).map((group) => {
                                        return (
                                            <div key={group.id} className="space-y-4 pb-6 border-b-2 border-gray-200 last:border-b-0">
                                                {/* Group Title */}
                                                {group.title && (
                                                    <div className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2">
                                                        {group.title}
                                                    </div>
                                                )}
                                                
                                                {/* Questions in this group */}
                                                {group.questions.map((q) => {
                                                    const global = flatSubquestions.find((x) => x.questionId === q.id);
                                                    return (
                                                        <div
                                                            key={q.id}
                                                            ref={(el) => {
                                                                if (global) questionRefs.current[global.globalIndex - 1] = el;
                                                            }}
                                                            className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                                                        >
                                                            {/* Question Number and Prompt */}
                                                            <div className="space-y-2">
                                                                <div className="text-sm font-semibold text-blue-700">
                                                                    Câu hỏi {q.order_index}
                                                                </div>
                                                                {q.prompt_md && (
                                                                    <div className="text-sm font-semibold text-gray-900">
                                                                        <MarkdownRenderer content={q.prompt_md} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Stimulus (content, instructions, media) */}
                                                            <StimulusRenderer stimulus={q.stimulus} />
                                                            
                                                            {/* Answer Input */}
                                                            <div className="pt-2 border-t border-gray-100">
                                                                <InteractionRenderer 
                                                                    question={q} 
                                                                    answers={answers} 
                                                                    onChange={updateAnswer} 
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* NEXT BUTTON (footer at bottom of right panel) */}
                            <div className="border-t border-gray-200 bg-white/90 backdrop-blur-md px-6 py-4">
                                {activeSectionIndex < assignment!.sections.length - 1 && (
                                    <button
                                        onClick={() => jumpToSection(activeSectionIndex + 1)}
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
                </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="mb-10 mt-10 ml-3 mr-3">
                <SidebarListening
                    assignment={assignment!}
                    flatSubquestions={flatSubquestions}
                    answers={answers}
                    setActiveSectionIndex={setActiveSectionIndex}
                    setCurrentSubIndex={setCurrentSubIndex}
                    onSubmit={handleSubmit}
                    onExit={() => router.push("/assignment")}
                />
            </div>
        </div>
    );
}
