"use client";

import { use, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getListeningAssignment, submitListening } from "@/services/assignment.service";
import {
    ListeningAssignmentDetail,
    ListeningSubmissionPayload,
} from "@/types/assignment";
import SidebarListening from "@/components/assignment/SidebarListening";
import QuestionsPanel from "@/components/assignment/ListeningQuestionsPanel";
import LoadingScreen from "@/components/loading-screen";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
    params: Promise<{ id: string }>;
}

export default function ListeningAssignmentPage(props: Props) {
    const { id } = use(props.params);
    const router = useRouter();

    const [assignment, setAssignment] =
        useState<ListeningAssignmentDetail | null>(null);

    const [loading, setLoading] = useState(true);
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);

    // USER ANSWERS
    const [answers, setAnswers] = useState<Record<string, string>>({});

    const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [currentSubIndex, setCurrentSubIndex] = useState(0);

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
            sec.questions.flatMap((q, qIndex) =>
                q.subquestions.map((sub, subIdx) => ({
                    globalIndex: 0, // fill later
                    sectionIndex: secIndex,
                    questionId: q.id,
                    subId: sub.id,
                    questionIndex: qIndex,
                    subIndex: subIdx,
                }))
            )
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

    function updateAnswer(subId: string, value: string) {
        setAnswers((prev) => ({ ...prev, [subId]: value }));
    }

    async function handleSubmit() {
        if (!assignment) return;

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || localStorage.getItem("user_id");
        
        if (!userId) {
            console.error("User ID not found");
            return;
        }

        const payload: ListeningSubmissionPayload = {
            assignment_id: assignment.id,
            submitted_by: userId!,
            section_answers: assignment.sections.map((section) => ({
                id: section.id,
                question_answers: section.questions.map((q) => ({
                    id: q.id,
                    subquestion_answers: q.subquestions.map((sub) => ({
                        answer: answers[sub.id] || "",
                    })),
                })),
            })),
        };

        const res = await submitListening(payload);

        const submissionId = res.data.id;

        router.push(`/assignment/listening/${assignment.id}/result/${submissionId}`);
    }

    if (loading) return <LoadingScreen />;
    if (!assignment || !activeSection) return <LoadingScreen />;

    return (
        <div className="flex w-full h-[900px] overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 border border-gray-300 rounded-lg shadow-md">
            {/* LEFT GROUP — Recording + Questions (like Reading UI) */}
            <div className="flex flex-1 rounded-3xl mb-20 mt-10 ml-3">
                {/* LEFT - Recording Panel */}
                <div className="flex-1 flex flex-col border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm rounded-l-2xl transition-all duration-300 hover:rounded-r-3x">
                    <div className="p-4 overflow-y-auto">
                        {/* TABS */}
                        <div className="flex gap-4 mb-4">
                            {assignment!.sections.map((sec, i) => (
                                <button
                                    key={sec.id}
                                    onClick={() => jumpToSection(i)}
                                    className={`px-4 py-2 rounded-full border ${i === activeSectionIndex
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100"
                                        }`}
                                >
                                    Recording {i + 1}
                                </button>
                            ))}
                        </div>

                        {/* AUDIO PLAYER */}
                        <audio
                            controls
                            src={activeSection.listening_material.audio_url}
                            className="w-full mb-6"
                        />
                    </div>
                </div>

                {/* RIGHT - Questions Panel */}
                <div className="w-[45%] flex border border-gray-300 flex-col bg-white/80 backdrop-blur-sm shadow-sm rounded-r-2xl transition-all duration-300 hover:rounded-r-3x">
                    <div className="flex-1 p-6 overflow-y-auto">
                        <QuestionsPanel
                            section={activeSection}
                            flatSubquestions={flatSubquestions}
                            answers={answers}
                            updateAnswer={updateAnswer}
                            currentSubIndex={currentSubIndex}
                            questionRefs={questionRefs}
                        />
                    </div>

                    {/* NEXT BUTTON (footer) */}
                    <div className="border-t border-gray-200 bg-white/90 backdrop-blur-md px-6 py-4 rounded-br-2xl transition-all duration-300 hover:rounded-r-3x">
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

            {/* RIGHT SIDEBAR */}
            <div className="mmb-10 mt-10 ml-3 mr-3">
                <SidebarListening
                    assignment={assignment!}
                    flatSubquestions={flatSubquestions}
                    answers={answers}
                    setActiveSectionIndex={setActiveSectionIndex}
                    setCurrentSubIndex={setCurrentSubIndex}
                    onSubmit={handleSubmit}
                />
            </div>
        </div>
    );
}
