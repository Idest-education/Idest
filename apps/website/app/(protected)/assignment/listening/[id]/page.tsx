"use client";

import { use, useEffect, useState, useRef } from "react";
import { getListeningAssignment, submitListening } from "@/services/assignment.service";
import {
    ListeningAssignmentDetail,
    ListeningSubmissionPayload,
} from "@/types/assignment";
import SidebarListening from "@/components/assignment/SidebarListening";
import QuestionsPanel from "@/components/assignment/ListeningQuestionsPanel";
import LoadingScreen from "@/components/loading-screen";

interface Props {
    params: Promise<{ id: string }>;
}

export default function ListeningAssignmentPage(props: Props) {
    const { id } = use(props.params);

    const [assignment, setAssignment] =
        useState<ListeningAssignmentDetail | null>(null);

    const [loading, setLoading] = useState(true);
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);

    // USER ANSWERS
    const [answers, setAnswers] = useState<Record<string, string>>({});

    const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [currentSubIndex, setCurrentSubIndex] = useState(0);


    async function load() {
        const res = await getListeningAssignment(id);
        setAssignment(res.data);
        setLoading(false);
    }

    useEffect(() => {
        load();
    }, []);

    function updateAnswer(subId: string, value: string) {
        setAnswers((prev) => ({ ...prev, [subId]: value }));
    }

    async function handleSubmit() {
        if (!assignment) return;

        const userId = localStorage.getItem("user_id");

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

        window.location.href = `/assignment/listening/${assignment.id}/result/${submissionId}`;
    }

    if (loading) return <LoadingScreen />;

    const activeSection = assignment!.sections[activeSectionIndex];

    const flatSubquestions = assignment!.sections.flatMap((sec, secIndex) =>
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

    // Gán số câu 1–40
    flatSubquestions.forEach((x, idx) => {
        x.globalIndex = idx + 1;
    });

    return (
        <div className="flex w-full h-[900px] overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 border border-gray-300 rounded-lg shadow-md">
            {/* LEFT SECTION SELECTOR + AUDIO + TRANSCRIPT + QUESTIONS */}
            <div className="flex-1 flex flex-col border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm p-4 mb-20 mt-10 ml-3 rounded-2xl transition-all duration-300 hover:rounded-r-3x">

                {/* TABS */}
                <div className="flex gap-4 mb-4">
                    {assignment!.sections.map((sec, i) => (
                        <button
                            key={sec.id}
                            onClick={() => setActiveSectionIndex(i)}
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

                {/* SECTION CONTENT */}
                <QuestionsPanel
                    section={activeSection}
                    flatSubquestions={flatSubquestions}
                    answers={answers}
                    updateAnswer={updateAnswer}
                    currentSubIndex={currentSubIndex}
                    questionRefs={questionRefs}
                />

                {/* NEXT BUTTON */}
                <div className="flex justify-end mt-auto">
                    {activeSectionIndex < assignment!.sections.length - 1 && (
                        <button
                            onClick={() => {
                                setActiveSectionIndex(activeSectionIndex + 1);
                                setCurrentSubIndex(() => {
                                    const first = flatSubquestions.find(
                                        (x) => x.sectionIndex === activeSectionIndex + 1
                                    );

                                    return first ? first.globalIndex - 1 : 0;
                                });

                                // Scroll lên đầu
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            Tiếp theo →
                        </button>
                    )}
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
