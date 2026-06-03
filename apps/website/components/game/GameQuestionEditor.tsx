"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateGameTemplateDto, QuestionType } from "@/types/game";
import { Plus, Trash2 } from "lucide-react";

type QuestionDraft = CreateGameTemplateDto["questions"][number];

interface GameQuestionEditorProps {
  questions: QuestionDraft[];
  onChange: (questions: QuestionDraft[]) => void;
}

const emptyQuestion = (order: number): QuestionDraft => ({
  text: "",
  type: "MULTIPLE_CHOICE",
  order,
  timerSeconds: 20,
  correctAnswer: "",
  options: [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ],
});

export function GameQuestionEditor({ questions, onChange }: GameQuestionEditorProps) {
  const update = (index: number, patch: Partial<QuestionDraft>) => {
    const next = questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
    onChange(next);
  };

  const addQuestion = () => {
    onChange([...questions, emptyQuestion(questions.length + 1)]);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })));
  };

  return (
    <div className="flex flex-col gap-6">
      {questions.map((q, i) => (
        <div key={q.order} style={{ border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,250,245,0.5)" }}>
              Question {i + 1}
            </span>
            <button onClick={() => removeQuestion(i)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <Input
            placeholder="Question text"
            value={q.text}
            onChange={(e) => update(i, { text: e.target.value })}
            className="mb-3"
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
          />

          <div className="flex gap-3 mb-3">
            <select
              value={q.type}
              onChange={(e) => update(i, {
                type: e.target.value as QuestionType,
                options: e.target.value === "MULTIPLE_CHOICE"
                  ? [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }]
                  : undefined,
              })}
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            >
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="FILL_BLANK">Fill in the Blank</option>
            </select>

            <Input
              type="number"
              min={5}
              max={120}
              value={q.timerSeconds}
              onChange={(e) => update(i, { timerSeconds: Number(e.target.value) || 20 })}
              placeholder="Timer (s)"
              style={{ width: 100, background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
            />
          </div>

          {q.type === "MULTIPLE_CHOICE" && (
            <div className="flex flex-col gap-2 mb-3">
              {(q.options ?? []).map((opt, oi) => (
                <div key={opt.label} className="flex items-center gap-2">
                  <span style={{ width: 20, fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>{opt.label}</span>
                  <Input
                    placeholder={`Option ${opt.label}`}
                    value={opt.text}
                    onChange={(e) => {
                      const opts = (q.options ?? []).map((o) =>
                        o.label === opt.label ? { ...o, text: e.target.value } : o,
                      );
                      update(i, { options: opts });
                    }}
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
                  />
                </div>
              ))}
            </div>
          )}

          <Input
            placeholder={q.type === "MULTIPLE_CHOICE" ? "Correct option label (A/B/C/D)" : "Correct answer"}
            value={q.correctAnswer}
            onChange={(e) => update(i, { correctAnswer: e.target.value })}
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#fffaf5" }}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addQuestion}
        style={{ borderColor: "#2a2a2a", color: "rgba(255,250,245,0.5)", background: "transparent" }}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Question
      </Button>
    </div>
  );
}
