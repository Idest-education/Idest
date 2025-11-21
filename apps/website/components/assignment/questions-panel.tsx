import { ReadingSection } from "@/types/assignment";
import { useRef, useEffect } from "react";

function indexToLetter(index: number): string {
    return String.fromCharCode(65 + index);
}

interface Props {
    section: ReadingSection;
    answers: Record<string, string | number>;
    setAnswers: (value: Record<string, string | number>) => void;
    currentQuestionIndex: number;
}

export default function QuestionsPanel({ section, answers, setAnswers, currentQuestionIndex }: Props) {

    // --- REF LIST FOR EACH QUESTION ---
    const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        const element = questionRefs.current[currentQuestionIndex];
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [currentQuestionIndex]);

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Questions</h2>

            {section.questions.map((q, qIndex) => (
                <div
                    key={q.id}
                    ref={(el) => {
                        questionRefs.current[qIndex] = el;
                    }}
                    className="mb-6"
                >
                    <p className="text-sm font-medium mb-2">{q.prompt}</p>

                    {q.subquestions.map((sub) => {
                        const key = sub.id;
                        const value = answers[key] ?? "";

                        const isFillBlank = sub.options.length === 0;
                        const isTrueFalse =
                            q.type === "true_false" ||
                            sub.options.includes("TRUE") ||
                            sub.options.includes("NOT GIVEN");

                        return (
                            <div key={sub.id} className="mb-4">
                                <p className="text-sm mb-1 text-gray-800 font-medium">{sub.subprompt}</p>

                                {/* CASE 1: Fill in the blank */}
                                {isFillBlank ? (
                                    <input
                                        className="text-sm border p-2 rounded w-full"
                                        placeholder="Your answer"
                                        value={value}
                                        onChange={(e) =>
                                            setAnswers({ ...answers, [key]: e.target.value })
                                        }
                                    />
                                ) : isTrueFalse ? (
                                    /* CASE 2: TRUE / FALSE / NOT GIVEN */
                                    <div className="text-sm ml-2 mt-1 flex flex-col gap-1">
                                        {sub.options.map((opt, idx) => (
                                            <label
                                                key={idx}
                                                className="flex items-center gap-2 cursor-pointer"
                                            >
                                                <input
                                                    type="radio"
                                                    name={key}
                                                    value={opt}
                                                    checked={value === opt}
                                                    onChange={() =>
                                                        setAnswers({ ...answers, [key]: opt })
                                                    }
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="font-medium">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    /* CASE 3: MULTIPLE CHOICE */
                                    <div className="text-sm ml-2 mt-1 flex flex-col gap-1">
                                        {sub.options.map((opt, idx) => (
                                            <label
                                                key={idx}
                                                className="flex items-center gap-2 cursor-pointer"
                                            >
                                                <input
                                                    type="radio"
                                                    name={key}
                                                    value={idx}
                                                    checked={value === idx || value === idx.toString()}
                                                    onChange={() =>
                                                        setAnswers({ ...answers, [key]: idx })
                                                    }
                                                    className="h-4 w-4 text-blue-600"
                                                />
                                                <span className="font-medium">{indexToLetter(idx)}.</span>
                                                <span>{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
