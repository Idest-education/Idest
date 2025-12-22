import { SubmitAssignmentV2Dto } from '../dto/v2/submit-assignment-v2.dto';

/**
 * Grading V2
 * - Uses question.answer_key and submission.section_answers[*].answers[*].answer
 * - Implements core types: gap_fill_template, multiple_choice_single, multiple_choice_multi, true_false_not_given, matching
 *
 * Notes:
 * - This is intentionally tolerant: string comparisons are case-insensitive + trimmed.
 * - For multi-select, order is ignored.
 */

export interface GradingResultV2 {
  score: number;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  percentage: number;
  details: Array<{
    section_id: string;
    section_title: string;
    questions: Array<{
      question_id: string;
      correct: boolean;
      parts?: Array<{
        key: string;
        correct: boolean;
        submitted_answer: any;
        correct_answer: any;
      }>;
    }>;
  }>;
}

function normalizeString(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function compareScalar(submitted: any, correct: any): boolean {
  if (typeof correct === 'string' || typeof submitted === 'string') {
    return normalizeString(submitted) === normalizeString(correct);
  }
  return submitted === correct;
}

function compareUnorderedArray(submitted: any, correct: any): boolean {
  if (!Array.isArray(submitted) || !Array.isArray(correct)) return false;
  if (submitted.length !== correct.length) return false;
  const a = submitted.map(normalizeString).sort();
  const b = correct.map(normalizeString).sort();
  return a.every((v, i) => v === b[i]);
}

function roundToHalf(score: number): number {
  const rounded = Math.round(score * 2) / 2;
  return Math.max(0, Math.min(9, rounded));
}

function indexAnswers(submission: SubmitAssignmentV2Dto) {
  const bySection = new Map<string, Map<string, any>>();
  for (const sec of submission.section_answers ?? []) {
    const byQuestion = new Map<string, any>();
    for (const qa of sec.answers ?? []) {
      byQuestion.set(qa.question_id, qa.answer);
    }
    bySection.set(sec.section_id, byQuestion);
  }
  return bySection;
}

export function gradeAssignmentV2(assignment: any, submission: SubmitAssignmentV2Dto): GradingResultV2 {
  const submittedIndex = indexAnswers(submission);

  let total = 0;
  let correctCount = 0;

  const details: GradingResultV2['details'] = [];

  for (const section of assignment.sections ?? []) {
    const sectionAnswers = submittedIndex.get(section.id) ?? new Map<string, any>();

    const sectionDetail: GradingResultV2['details'][number] = {
      section_id: section.id,
      section_title: section.title,
      questions: [],
    };

    const groups = section.question_groups ?? [];
    for (const group of groups) {
      for (const q of group.questions ?? []) {
        total += 1;
        const submitted = sectionAnswers.get(q.id);

        const qDetail: GradingResultV2['details'][number]['questions'][number] = {
          question_id: q.id,
          correct: false,
          parts: [],
        };

        const type = q.type;
        const key = q.answer_key;

        // gap_fill_template: { blanks: { [blank_id]: string } }
        if (type === 'gap_fill_template') {
          const submittedBlanks = submitted?.blanks ?? {};
          const correctBlanks = key?.blanks ?? {};
          const blankIds = Object.keys(correctBlanks);

          let allCorrect = true;
          for (const blankId of blankIds) {
            const sVal = submittedBlanks?.[blankId];
            const cVal = correctBlanks?.[blankId];
            const ok = compareScalar(sVal, cVal);
            qDetail.parts?.push({
              key: blankId,
              correct: ok,
              submitted_answer: sVal,
              correct_answer: cVal,
            });
            if (!ok) allCorrect = false;
          }
          qDetail.correct = allCorrect;
        }

        // multiple_choice_single: { choice: optionId }
        else if (type === 'multiple_choice_single') {
          const ok = compareScalar(submitted?.choice, key?.choice);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'choice',
            correct: ok,
            submitted_answer: submitted?.choice,
            correct_answer: key?.choice,
          });
        }

        // multiple_choice_multi: { choices: optionId[] }
        else if (type === 'multiple_choice_multi') {
          const ok = compareUnorderedArray(submitted?.choices, key?.choices);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'choices',
            correct: ok,
            submitted_answer: submitted?.choices,
            correct_answer: key?.choices,
          });
        }

        // true_false_not_given: { choice: 'TRUE' | 'FALSE' | 'NOT_GIVEN' }
        else if (type === 'true_false_not_given') {
          const ok = compareScalar(submitted?.choice, key?.choice);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'choice',
            correct: ok,
            submitted_answer: submitted?.choice,
            correct_answer: key?.choice,
          });
        }

        // matching: two formats supported
        // 1. Complex: { map: { [leftId]: rightId } } with key.map
        // 2. Simple: { choice: "A" } with key.correct_answer
        else if (type === 'matching') {
          // Check if it's complex matching format
          if (key?.map && typeof key.map === 'object') {
            const submittedMap = submitted?.map ?? {};
            const correctMap = key.map;
            const leftIds = Object.keys(correctMap);
            let allCorrect = true;
            for (const leftId of leftIds) {
              const sVal = submittedMap?.[leftId];
              const cVal = correctMap?.[leftId];
              const ok = compareScalar(sVal, cVal);
              qDetail.parts?.push({
                key: leftId,
                correct: ok,
                submitted_answer: sVal,
                correct_answer: cVal,
              });
              if (!ok) allCorrect = false;
            }
            qDetail.correct = allCorrect;
          } else {
            // Simple single-choice matching format
            const ok = compareScalar(submitted?.choice, key?.correct_answer);
            qDetail.correct = ok;
            qDetail.parts?.push({
              key: 'choice',
              correct: ok,
              submitted_answer: submitted?.choice,
              correct_answer: key?.correct_answer,
            });
          }
        }

        // short_answer: { text: string } with key.correct_answer
        else if (type === 'short_answer') {
          const ok = compareScalar(submitted?.text, key?.correct_answer);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'text',
            correct: ok,
            submitted_answer: submitted?.text,
            correct_answer: key?.correct_answer,
          });
        }

        // fallback: strict equality on submitted.answer vs answer_key.answer
        else {
          const ok = compareScalar(submitted, key);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'value',
            correct: ok,
            submitted_answer: submitted,
            correct_answer: key,
          });
        }

        if (qDetail.correct) correctCount += 1;
        sectionDetail.questions.push(qDetail);
      }
    }

    details.push(sectionDetail);
  }

  const percentage = total > 0 ? (correctCount / total) * 100 : 0;
  const rawScore = (percentage / 100) * 9;
  const score = roundToHalf(rawScore);

  return {
    score,
    total_questions: total,
    correct_answers: correctCount,
    incorrect_answers: total - correctCount,
    percentage: Math.round(percentage * 100) / 100,
    details,
  };
}


