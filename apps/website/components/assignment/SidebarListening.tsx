"use client";

import { useEffect, useRef, useState } from "react";
import { ListeningAssignmentDetail } from "@/types/assignment"

interface Props {
    assignment: ListeningAssignmentDetail;
    flatSubquestions: {
        globalIndex: number;
        sectionIndex: number;
        subId: string;
    }[];
    answers: Record<string, string>;
    setActiveSectionIndex: (i: number) => void;
    setCurrentSubIndex: (i: number) => void;
    onSubmit: () => void;
}

export default function SidebarListening({
    assignment,
    flatSubquestions,
    answers,
    setActiveSectionIndex,
    setCurrentSubIndex,
    onSubmit,
}: Props) {

    const totalMinutes = 40;
    const [seconds, setSeconds] = useState(totalMinutes * 60);
    const submittedRef = useRef(false);

    useEffect(() => {
        const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (seconds === 0 && !submittedRef.current) {
            submittedRef.current = true;
            onSubmit();
        }
    }, [seconds]);

    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;

    return (
        <div className="w-[280px] bg-white/40 backdrop-blur-xl border-l border-white/20 flex flex-col shadow-2xl">

            {/* HEADER */}
            <div className="p-6 border-b border-white/20 bg-white/30 backdrop-blur-md">

                {/* TIMER */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-600 text-sm font-medium">
                            Thời gian còn lại
                        </span>

                        <div className={`text-2xl font-bold 
                            ${seconds < 300 ? "text-red-600 animate-pulse" : "text-slate-800"}`}>
                            {mm.toString().padStart(2, "0")}:
                            {ss.toString().padStart(2, "0")}
                        </div>
                    </div>

                    <div className="w-full bg-red-200 rounded-full h-1.5">
                        <div
                            className="bg-red-600 h-1.5 rounded-full transition-all duration-1000"
                            style={{
                                width: `${(seconds / (totalMinutes * 60)) * 100}%`,
                            }}
                        />
                    </div>
                </div>

                {/* SUBMIT BUTTON */}
                <button
                    onClick={onSubmit}
                    className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold 
                        hover:from-blue-700 hover:to-indigo-800 active:scale-95 transition-all duration-200 
                        shadow-md hover:shadow-lg"
                >
                    NỘP BÀI
                </button>
            </div>

            {/* SECTION / RECORDINGS */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {assignment.sections.map((sec, secIdx) => {
                    const items = flatSubquestions.filter(f => f.sectionIndex === secIdx);
                    const answeredCount = items.filter(i => answers[i.subId]).length;

                    return (
                        <div
                            key={sec.id}
                            className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <p className="font-semibold text-slate-800 text-sm">
                                    Bài nghe {secIdx + 1}
                                </p>

                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    {answeredCount}/{items.length}
                                </span>
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                                {items.map((f) => {
                                    const answered = answers[f.subId] !== undefined;

                                    return (
                                        <button
                                            key={f.subId}
                                            onClick={() => {
                                                setActiveSectionIndex(f.sectionIndex);
                                                setCurrentSubIndex(f.globalIndex - 1);
                                            }}
                                            className={`
                                                w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium
                                                transition-all duration-200 transform hover:scale-110 active:scale-95
                                                ${answered
                                                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                                                }
                                            `}
                                        >
                                            {f.globalIndex}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* LEGEND */}
            <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center justify-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-md"></div>
                        <span className="text-slate-600">Đã trả lời</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-6 h-6 bg-slate-100 border border-slate-300 rounded-md"></div>
                        <span className="text-slate-600">Chưa trả lời</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
