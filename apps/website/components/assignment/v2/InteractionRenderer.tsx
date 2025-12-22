"use client";

import { useMemo } from "react";
import type { QuestionV2Client } from "@/types/assignment";

type AnswerStore = Record<string, unknown>;

export type UpdateAnswerFn = (questionId: string, answer: unknown) => void;

function normalizeBlanksFromTemplateBody(body: string): string[] {
  const re = /\{\{\s*blank\s*:\s*([a-zA-Z0-9_-]+)\s*\}\}/g;
  const found: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.push(m[1]);
  }
  // preserve order but unique
  return Array.from(new Set(found));
}

function normalizeMultipleChoiceOptions(rawOptions: unknown[]): Array<{ id: string; label_md: string; label: string }> {
  if (!Array.isArray(rawOptions)) return [];
  
  return rawOptions.map((opt, index) => {
    // If it's already an object with id/label, use it
    if (typeof opt === 'object' && opt !== null && 'id' in opt) {
      return {
        id: String((opt as { id: unknown }).id),
        label_md: String((opt as { label_md?: unknown }).label_md ?? (opt as { label?: unknown }).label ?? (opt as { id: unknown }).id),
        label: String((opt as { label?: unknown }).label ?? (opt as { label_md?: unknown }).label_md ?? (opt as { id: unknown }).id),
      };
    }
    // If it's a string, convert to object with letter id (A, B, C, ...)
    if (typeof opt === 'string') {
      const letterId = String.fromCharCode(65 + index); // A, B, C, ...
      return {
        id: letterId,
        label_md: opt,
        label: opt,
      };
    }
    // Fallback
    return {
      id: String(index),
      label_md: String(opt),
      label: String(opt),
    };
  });
}

export default function InteractionRenderer({
  question,
  answers,
  onChange,
}: {
  question: QuestionV2Client;
  answers: AnswerStore;
  onChange: UpdateAnswerFn;
}) {
  const value = answers[question.id];

  if (question.type === "gap_fill_template") {
    const template = question.stimulus.template;
    const blankIds = useMemo(() => {
      if (template?.blanks?.length) return template.blanks.map((b) => b.blank_id);
      if (template?.body) return normalizeBlanksFromTemplateBody(template.body);
      return [];
    }, [template]);

    const blanks = (value as any)?.blanks && typeof (value as any).blanks === "object" ? (value as any).blanks : {};

    return (
      <div className="space-y-3">
        {blankIds.map((blankId) => (
          <div key={blankId} className="flex items-center gap-2">
            <div className="w-10 text-sm font-medium text-gray-700">{blankId}</div>
            <input
              className="flex-1 text-sm border p-2 rounded"
              value={String(blanks[blankId] ?? "")}
              onChange={(e) => {
                onChange(question.id, { blanks: { ...blanks, [blankId]: e.target.value } });
              }}
              placeholder="Your answer"
            />
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_choice_single") {
    const rawOptions = (question.interaction as { options?: unknown[] })?.options ?? [];
    const choice = (value as { choice?: string })?.choice ?? "";
    
    // Normalize options: handle both string arrays and object arrays
    const options = normalizeMultipleChoiceOptions(rawOptions);
    
    return (
      <div className="space-y-2">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={question.id}
              checked={choice === opt.id}
              onChange={() => onChange(question.id, { choice: opt.id })}
            />
            <span>{opt.label_md ?? opt.label ?? opt.id}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "true_false_not_given") {
    const choice = (value as any)?.choice ?? "";
    const opts = ["TRUE", "FALSE", "NOT_GIVEN"];
    return (
      <div className="space-y-2">
        {opts.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={question.id}
              checked={choice === opt}
              onChange={() => onChange(question.id, { choice: opt })}
            />
            <span>{opt.replace("_", " ")}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "matching") {
    // Handle two formats:
    // 1. New format: interaction.left and interaction.right (for complex matching)
    // 2. Legacy format: interaction.options (for simple single-choice matching)
    const left = (question.interaction as any)?.left ?? [];
    const right = (question.interaction as any)?.right ?? [];
    const options = (question.interaction as any)?.options ?? [];
    
    // If we have left/right format (complex matching)
    if (left.length > 0 && right.length > 0) {
      const map = (value as any)?.map && typeof (value as any).map === "object" ? (value as any).map : {};

      return (
        <div className="space-y-3">
          {left.map((l: any) => (
            <div key={l.id} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-7 text-sm text-gray-800">{l.label_md ?? l.label ?? l.id}</div>
              <div className="col-span-5">
                <select
                  className="w-full border rounded p-2 text-sm bg-white"
                  value={String(map[l.id] ?? "")}
                  onChange={(e) => onChange(question.id, { map: { ...map, [l.id]: e.target.value } })}
                >
                  <option value="">-- select --</option>
                  {right.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.label_md ?? r.label ?? r.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // Legacy format: single-choice matching with options array
    if (options.length > 0) {
      const choice = (value as any)?.choice ?? "";
      return (
        <div className="space-y-2">
          <select
            className="w-full border rounded p-2 text-sm bg-white"
            value={String(choice)}
            onChange={(e) => onChange(question.id, { choice: e.target.value })}
          >
            <option value="">-- select --</option>
            {options.map((opt: string, idx: number) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }
    
    // Fallback if no options found
    return <div className="text-sm text-gray-500">No options available</div>;
  }

  if (question.type === "short_answer") {
    const text = (value as any)?.text ?? "";
    const maxWords = (question.interaction as any)?.max_words;
    const allowNumbers = (question.interaction as any)?.allow_numbers ?? true;
    
    return (
      <div className="space-y-2">
        <input
          className="w-full text-sm border p-2 rounded"
          value={String(text)}
          onChange={(e) => onChange(question.id, { text: e.target.value })}
          placeholder="Your answer"
        />
        {maxWords && (
          <p className="text-xs text-gray-500">
            Maximum {maxWords} word{maxWords > 1 ? 's' : ''}
            {!allowNumbers && ' (no numbers)'}
          </p>
        )}
      </div>
    );
  }

  // fallback: short answer (for other types that need text input)
  const text = (value as any)?.text ?? "";
  return (
    <input
      className="w-full text-sm border p-2 rounded"
      value={String(text)}
      onChange={(e) => onChange(question.id, { text: e.target.value })}
      placeholder="Your answer"
    />
  );
}


