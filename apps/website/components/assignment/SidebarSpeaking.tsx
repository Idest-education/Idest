"use client";

import { useEffect, useState, useRef } from "react";
import { Clock, CheckCircle2, X } from "lucide-react";

interface Props {
    onSubmit: () => void;
    activePart: 1 | 2;
    setActivePart: (t: 1 | 2) => void;
    onExit?: () => void;
}

export default function SidebarSpeaking({ activePart, setActivePart, onSubmit, onExit }: Props) {
    const TOTAL_SECONDS = 15 * 60;
    const [seconds, setSeconds] = useState(TOTAL_SECONDS);
    const hasSubmittedRef = useRef(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setSeconds((s) => Math.max(s - 1, 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (seconds === 0 && !hasSubmittedRef.current) {
            hasSubmittedRef.current = true;
            onSubmit();
        }
    }, [seconds, onSubmit]);

    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;
    const percent = (seconds / TOTAL_SECONDS) * 100;

    return (
        <div className="w-[280px] bg-white/40 backdrop-blur-xl border-l border-white/20 flex flex-col shadow-2xl">

            {/* HEADER */}
            <div className="p-6 border-b border-white/20 bg-white/30 backdrop-blur-md">

                {/* TIMER */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-600 text-sm font-medium flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Thời gian
                        </span>
                        <div className={`text-2xl font-bold ${seconds < 30 ? "text-red-600 animate-pulse" : "text-slate-800"}`}>
                            {mm}:{ss.toString().padStart(2, "0")}
                        </div>
                    </div>

                    <div className="w-full bg-red-200 rounded-full h-1.5">
                        <div
                            className="bg-red-600 h-1.5 rounded-full transition-all duration-1000"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>

                {/* PART SWITCH */}
                <div className="mt-5 bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setActivePart(1)}
                            className={`py-2.5 rounded-lg font-semibold transition-all duration-200 
                            ${activePart === 1
                                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:shadow-lg"
                                    : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200"
                                }`}
                        >
                            Phần 1
                        </button>

                        <button
                            onClick={() => setActivePart(2)}
                            className={`py-2.5 rounded-lg font-semibold transition-all duration-200 
                            ${activePart === 2
                                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:shadow-lg"
                                    : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200"
                                }`}
                        >
                            Phần 2 + 3
                        </button>
                    </div>
                </div>

                {/* SUBMIT */}
                <button
                    onClick={onSubmit}
                    className="w-full mt-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold 
                           hover:from-blue-700 hover:to-indigo-800 active:scale-95 transition-all duration-200 
                           shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                    NỘP BÀI
                </button>

                {/* EXIT BUTTON */}
                {onExit && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.confirm("Bạn có chắc chắn muốn thoát? Tất cả bài làm của bạn sẽ bị mất!")) {
                                onExit();
                            }
                        }}
                        className="w-full mt-3 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium 
                                 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg 
                                 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                        Thoát
                    </button>
                )}
            </div>

        </div>
    );
}
