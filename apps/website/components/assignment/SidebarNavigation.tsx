import { useEffect, useState } from "react";
import { Clock, CheckCircle2 } from "lucide-react";

// Mock types for preview
interface SubQuestion {
    id: string;
}

interface Question {
    subquestions: SubQuestion[];
}

interface Section {
    questions: Question[];
}

interface ReadingAssignmentDetail {
    skill: string;
    sections: Section[];
}

interface Props {
    assignment: ReadingAssignmentDetail;
    activePassage: number;
    setActivePassage: (value: number) => void;
    answers: Record<string, string | number>;
    setCurrentQuestionIndex: (value: number) => void;
    onSubmit: () => void;
}

export default function SidebarNavigation({
    assignment,
    activePassage,
    setActivePassage,
    answers,
    setCurrentQuestionIndex,
    onSubmit
}: Props) {

    // TIMER (theo skill)
    const skillTime: Record<string, number> = {
        reading: 60,
        writing: 60,
        listening: 40,
        speaking: 15
    };

    const totalMinutes = skillTime[assignment.skill] ?? 60;
    const [secondsLeft, setSecondsLeft] = useState(totalMinutes * 60);

    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsLeft((s) => Math.max(s - 1, 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    // ==== FLATTEN ALL PASSAGES ====
    const allPassages = assignment.sections.map((section, passageIndex) => {
        const subList = section.questions.flatMap((q, qIndex) =>
            q.subquestions.map((sub, subIndex) => ({
                globalIndex: 0,
                passageIndex,
                questionIndex: qIndex,
                subIndex,
                subId: sub.id
            }))
        );

        return {
            passageIndex,
            section,
            subList
        };
    });

    // Assign global numbering
    let counter = 1;
    allPassages.forEach((p) => {
        p.subList.forEach((item) => {
            item.globalIndex = counter++;
        });
    });

    return (
        <div className="w-[280px] bg-white/40 backdrop-blur-xl border-l border-white/20 flex flex-col shadow-2xl">

            {/* HEADER SECTION */}
            <div className="p-6 border-b border-white/20 bg-white/30 backdrop-blur-md">
                {/* TIMER */}
                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-600 text-sm font-medium flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Thời gian
                        </span>
                        <div className={`text-2xl font-bold ${secondsLeft < 300 ? 'text-red-600 animate-pulse' : 'text-slate-800'}`}>
                            {minutes}:{seconds.toString().padStart(2, "0")}
                        </div>
                    </div>
                    <div className="w-full bg-red-200 rounded-full h-1.5">
                        <div
                            className="bg-red-600 h-1.5 rounded-full transition-all duration-1000"
                            style={{ width: `${(secondsLeft / (totalMinutes * 60)) * 100}%` }}
                        />
                    </div>
                </div>

                {/* SUBMIT BUTTON */}
                <button
                    onClick={onSubmit}
                    className="w-full mt-4 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-semibold 
                             hover:from-green-700 hover:to-green-800 active:scale-95 transition-all duration-200 
                             shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                    <CheckCircle2 className="w-5 h-5" />
                    NỘP BÀI
                </button>
            </div>

            {/* PASSAGES SECTION */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {allPassages.map((p) => {
                    const passageAnswered = p.subList.filter(item => answers[item.subId] !== undefined).length;
                    const passageTotal = p.subList.length;

                    return (
                        <div key={p.passageIndex} className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <p className="font-semibold text-slate-800 text-sm">
                                    Passage {p.passageIndex + 1}
                                </p>
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    {passageAnswered}/{passageTotal}
                                </span>
                            </div>

                            <div className="grid grid-cols-5 gap-2">
                                {p.subList.map((item) => {
                                    const answered = answers[item.subId] !== undefined;
                                    const isActive = item.passageIndex === activePassage;

                                    return (
                                        <button
                                            key={item.subId}
                                            onClick={() => {
                                                setActivePassage(item.passageIndex);
                                                setCurrentQuestionIndex(item.subIndex);
                                            }}
                                            className={`
                                                w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium
                                                transition-all duration-200 transform hover:scale-110 active:scale-95
                                                ${answered
                                                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                                                }
                                                ${isActive ? "ring-2 ring-blue-400 ring-offset-2" : ""}
                                            `}
                                        >
                                            {item.globalIndex}
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
