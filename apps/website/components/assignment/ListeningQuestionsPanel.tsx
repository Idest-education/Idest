"use client";

import { ListeningSection } from "@/types/assignment";

interface Props {
    section: ListeningSection;
    flatSubquestions: {
        globalIndex: number;
        sectionIndex: number;
        subId: string;
        questionId: string;
        questionIndex: number;
        subIndex: number;
    }[];
    answers: Record<string, string>;
    updateAnswer: (subId: string, value: string) => void;
    currentSubIndex: number;
    questionRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}

export default function ListeningQuestionsPanel({
    section,
    flatSubquestions,
    answers,
    updateAnswer,
    questionRefs,
}: Props) {

    flatSubquestions.forEach((x, i) => (x.globalIndex = i + 1));

    return (
        <div className="space-y-8">
            {section.questions.map((q) =>
                q.subquestions.map((sub) => {
                    const global = flatSubquestions.find((x) => x.subId === sub.id);

                    if (!global) return null;

                    return (
                        <div
                            key={sub.id}
                            ref={(el) => {
                                questionRefs.current[global.globalIndex - 1] = el;
                            }}
                            className="rounded bg-white grid grid-cols-12 gap-4"
                        >
                            {/* LEFT: QUESTION TEXT */}
                            <div className="col-span-7">
                                <p className="font-semibold mb-1 text-blue-600">
                                    Câu hỏi {global.globalIndex}
                                </p>

                                <p className="font-medium mb-2">{q.prompt}</p>
                                <p className="text-gray-700">{sub.subprompt}</p>
                            </div>

                            {/* RIGHT: ANSWER INPUT */}
                            <div className="col-span-5 flex items-center">
                                {q.type === "fill_blank" ? (
                                    <input
                                        type="text"
                                        className="border p-2 w-full rounded"
                                        value={answers[sub.id] ?? ""}
                                        onChange={(e) =>
                                            updateAnswer(sub.id, e.target.value)
                                        }
                                    />
                                ) : (
                                    <div className="space-y-2 w-full">
                                        {sub.options.map((opt) => (
                                            <label key={opt} className="block">
                                                <input
                                                    type="radio"
                                                    name={sub.id}
                                                    checked={answers[sub.id] === opt}
                                                    onChange={() => updateAnswer(sub.id, opt)}
                                                />
                                                <span className="ml-2">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
