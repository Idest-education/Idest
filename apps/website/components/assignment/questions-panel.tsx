import { ReadingSection } from "@/types/assignment";
import { useRef, useEffect, useMemo } from "react";
import MarkdownRenderer from "@/components/conversation/MarkdownRenderer";

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
            <h2 className="text-xl font-semibold mb-4">Câu hỏi</h2>

            {section.questions.map((q, qIndex) => {
                // For matching questions, collect all unique options from all subquestions
                const matchingOptions = q.type === "matching"
                    ? Array.from(new Set(q.subquestions.flatMap(sub => sub.options)))
                    : [];

                return (
                <div
                    key={q.id}
                    ref={(el) => {
                        questionRefs.current[qIndex] = el;
                    }}
                    className="mb-6"
                >
                        <div className="text-sm font-medium mb-2">
                            <MarkdownRenderer content={q.prompt} />
                        </div>

                    {q.subquestions.map((sub) => {
                        const key = sub.id;
                        const value = answers[key] ?? "";

                        const isFillBlank = sub.options.length === 0;
                        const isTrueFalse =
                            q.type === "true_false" ||
                            sub.options.includes("TRUE") ||
                            sub.options.includes("NOT GIVEN");
                            const isMatching = q.type === "matching";

                        return (
                            <div key={sub.id} className="mb-4">
                                    <div className="text-sm mb-1 text-gray-800 font-medium">
                                        <MarkdownRenderer content={sub.subprompt} />
                                    </div>

                                {/* CASE 1: Fill in the blank */}
                                {isFillBlank ? (
                                    <input
                                        className="text-sm border p-2 rounded w-full"
                                        placeholder="Câu trả lời của bạn"
                                            value={typeof value === "string" ? value : ""}
                                        onChange={(e) =>
                                            setAnswers({ ...answers, [key]: e.target.value })
                                        }
                                    />
                                    ) : isMatching ? (
                                        /* CASE 2: MATCHING - Dropdown */
                                        <select
                                            className="text-sm border p-2 rounded w-full bg-white"
                                            value={typeof value === "string" ? value : ""}
                                            onChange={(e) =>
                                                setAnswers({ ...answers, [key]: e.target.value })
                                            }
                                        >
                                            <option value="">-- Chọn đáp án --</option>
                                            {matchingOptions.map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                ) : isTrueFalse ? (
                                        /* CASE 3: TRUE / FALSE / NOT GIVEN */
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
                                        /* CASE 4: MULTIPLE CHOICE */
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
                );
            })}
        </div>
    );
}
