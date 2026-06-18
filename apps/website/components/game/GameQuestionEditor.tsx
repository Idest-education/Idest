"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameMatchLREditor } from "@/components/game/GameMatchLREditor";
import { CreateGameTemplateDto, QuestionType } from "@/types/game";
import { Plus, Trash2 } from "lucide-react";

interface MatchPairInput {
  leftText: string;
  rightText: string;
}

// Extend the base DTO type locally to carry match-pair data while editing
type QuestionDraft = CreateGameTemplateDto["questions"][number] & {
  matchPairs?: MatchPairInput[];
};

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
        <div key={q.order} style={{ border: "1px solid var(--color-border-default)", borderRadius: 8, padding: 16, background: "var(--color-surface-card)" }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)" }}>
              Question {i + 1}
            </span>
            <button onClick={() => removeQuestion(i)} style={{ color: "var(--color-error)", background: "none", border: "none", cursor: "pointer" }}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <Input
            placeholder="Question text"
            value={q.text}
            onChange={(e) => update(i, { text: e.target.value })}
            className="mb-3"
          />

          <div className="flex gap-3 mb-3">
            <select
              value={q.type}
              onChange={(e) => {
                const newType = e.target.value as QuestionType;
                update(i, {
                  type: newType,
                  options:
                    newType === "MULTIPLE_CHOICE" || newType === "MULTI_CHOICE"
                      ? [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }]
                      : undefined,
                  matchPairs: newType === "MATCH_LR" ? [{ leftText: "", rightText: "" }] : undefined,
                  correctAnswer: "",
                });
              }}
              style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)", color: "var(--color-text-primary)", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            >
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="MULTI_CHOICE">Multi-Select</option>
              <option value="FILL_BLANK">Fill in the Blank</option>
              <option value="MATCH_LR">Match Left / Right</option>
              {/* <option value="WORD_CLOUD">Word Cloud</option> */}
            </select>

            <Input
              type="number"
              min={5}
              max={120}
              value={q.timerSeconds}
              onChange={(e) => update(i, { timerSeconds: Number(e.target.value) || 20 })}
              placeholder="Timer (s)"
              style={{ width: 100 }}
            />
          </div>

          {/* Options list — MULTIPLE_CHOICE and MULTI_CHOICE */}
          {(q.type === "MULTIPLE_CHOICE" || q.type === "MULTI_CHOICE") && (
            <div className="flex flex-col gap-2 mb-3">
              {(q.options ?? []).map((opt, oi) => (
                <div key={opt.label} className="flex items-center gap-2">
                  <span style={{ width: 20, fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>{opt.label}</span>
                  <Input
                    placeholder={`Option ${opt.label}`}
                    value={opt.text}
                    onChange={(e) => {
                      const opts = (q.options ?? []).map((o) =>
                        o.label === opt.label ? { ...o, text: e.target.value } : o,
                      );
                      update(i, { options: opts });
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Match pairs editor — MATCH_LR */}
          {q.type === "MATCH_LR" && (
            <div className="mb-3">
              <GameMatchLREditor
                pairs={q.matchPairs ?? []}
                onChange={(pairs) => update(i, { matchPairs: pairs })}
              />
            </div>
          )}

          {/* Correct answer — hidden for WORD_CLOUD and MATCH_LR */}
          {q.type !== "WORD_CLOUD" && q.type !== "MATCH_LR" && (
            <Input
              placeholder={
                q.type === "MULTIPLE_CHOICE"
                  ? "Correct option label (A/B/C/D)"
                  : q.type === "MULTI_CHOICE"
                  ? "Correct labels, comma-separated (e.g. A,C)"
                  : "Correct answer"
              }
              value={q.correctAnswer}
              onChange={(e) => update(i, { correctAnswer: e.target.value })}
            />
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addQuestion}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Question
      </Button>
    </div>
  );
}
