"use client";

import MarkdownRenderer from "@/components/conversation/MarkdownRenderer";
import type { QuestionV2Client } from "@/types/assignment";
import StimulusRenderer from "./StimulusRenderer";
import InteractionRenderer, { type UpdateAnswerFn } from "./InteractionRenderer";

export default function QuestionRenderer({
  question,
  indexLabel,
  answers,
  onChange,
}: {
  question: QuestionV2Client;
  indexLabel?: string;
  answers: Record<string, unknown>;
  onChange: UpdateAnswerFn;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {indexLabel && <div className="text-sm font-semibold text-blue-700">{indexLabel}</div>}
          {question.prompt_md && (
            <div className="text-sm font-semibold text-gray-900">
              <MarkdownRenderer content={question.prompt_md} />
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500">{question.type}</div>
      </div>

      <StimulusRenderer stimulus={question.stimulus} />

      <div className="pt-2 border-t border-gray-100">
        <InteractionRenderer question={question} answers={answers} onChange={onChange} />
      </div>
    </div>
  );
}


