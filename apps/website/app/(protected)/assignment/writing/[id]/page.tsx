"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getWritingAssignment, submitWriting } from "@/services/assignment.service";
import { WritingAssignmentDetail } from "@/types/assignment";
import SidebarWriting from "@/components/assignment/SidebarWriting";
import LoadingScreen from "@/components/loading-screen";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function WritingAssignmentPage(props: PageProps) {
    const { id } = use(props.params);
    const router = useRouter();

    const [assignment, setAssignment] = useState<WritingAssignmentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTask, setActiveTask] = useState<1 | 2>(1);

    // User writing content
    const [contentOne, setContentOne] = useState("");
    const [contentTwo, setContentTwo] = useState("");

    const [submitting, setSubmitting] = useState(false);


    useEffect(() => {
        async function load() {
            try {
                const res = await getWritingAssignment(id);
                setAssignment(res.data);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    async function handleSubmit() {
        if (!assignment) return;

        // VALIDATION
        if (contentOne.trim().length === 0 || contentTwo.trim().length === 0) {
            alert("Bạn phải hoàn thành cả Nhiệm vụ 1 và Nhiệm vụ 2 trước khi nộp bài.");
            return;
        }

        const userId = localStorage.getItem("user_id");

        setSubmitting(true);

        const payload = {
            assignment_id: assignment.id,
            user_id: userId!,
            contentOne,
            contentTwo,
        };

        const res = await submitWriting(payload);
        // Mark that we should show the "queued for grading" popup after redirect
        try {
            sessionStorage.setItem("assignment_grading_queued", "1");
        } catch {}
        router.push("/assignment/submissions");
    }

    if (submitting) {
        return <LoadingScreen />;
    }

    if (loading) {
        return <LoadingScreen />;
    }

    if (!assignment) return <p className="p-4">Không tìm thấy</p>;

    return (
        <div className="flex w-full h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="flex flex-1 mb-20 mt-10 ml-3">
                {/* LEFT CONTENT (Task info) */}
                <div className="flex-1 flex flex-col border border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm p-4 rounded-l-2xl overflow-y-auto">
                    {/* TASK SWITCH */}
                    <div className="flex gap-3 mb-4">
                        <button
                            className={`px-4 py-2 rounded-full border ${activeTask === 1 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                            onClick={() => setActiveTask(1)}
                        >
                            Nhiệm vụ 1
                        </button>
                        <button
                            className={`px-4 py-2 rounded-full border ${activeTask === 2 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                            onClick={() => setActiveTask(2)}
                        >
                            Nhiệm vụ 2
                        </button>
                    </div>

                    {/* TASK CONTENT */}
                    {activeTask === 1 ? (
                        <div>
                            <p className="text-gray-800 whitespace-pre-line mb-4">{assignment.taskone}</p>

                            {assignment.img && (
                                <img src={assignment.img} className="rounded mb-4 max-w-full" />
                            )}
                        </div>
                    ) : (
                        <div>
                            <p className="text-gray-800 whitespace-pre-line">
                                {assignment.tasktwo}
                            </p>
                        </div>
                    )}
                </div>

                {/* MIDDLE — EDITOR */}
                <div className="w-[45%] flex flex-col border-x border-y border-gray-300 bg-white/80 backdrop-blur-sm shadow-sm rounded-r-2xl overflow-hidden">

                    <div className="flex-1 flex flex-col p-6 min-h-0">
                        <textarea
                            className="flex-1 w-full p-4 border rounded resize-none focus:ring-2 focus:ring-blue-400 min-h-0"
                            placeholder="Viết bài luận của bạn ở đây..."
                            value={activeTask === 1 ? contentOne : contentTwo}
                            onChange={(e) =>
                                activeTask === 1 ? setContentOne(e.target.value) : setContentTwo(e.target.value)
                            }
                        />

                        {/* WORD COUNT */}
                        <div className="mt-3 text-right text-sm text-slate-600">
                            Số từ:{" "}
                            <span className="font-semibold text-slate-800">
                                {countWords(activeTask === 1 ? contentOne : contentTwo)}
                            </span>
                        </div>
                    </div>

                    {/* BOTTOM NEXT BUTTON */}
                    <div className="border-t border-gray-200 bg-white/90 backdrop-blur-md px-6 py-4">
                        {activeTask < 2 && (
                            <button
                                onClick={() => setActiveTask(2)}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 
                           hover:from-blue-700 hover:to-indigo-700 text-white font-medium 
                           rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                           transition-all duration-200 flex items-center justify-center gap-2"
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

            {/* RIGHT — SIDEBAR */}
            <div className="mb-10 mt-10 ml-3 mr-3">
                <SidebarWriting
                    onSubmit={handleSubmit}
                    activeTask={activeTask}
                    setActiveTask={setActiveTask}
                    onExit={() => router.push("/assignment")}
                />
            </div>
        </div>
    );
}

function countWords(text: string) {
    return text
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0).length;
}
