import { SubmitObjectiveAssignmentDto } from '../dto/objective/submit-objective.dto';

export interface GradingObjectiveResult {
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
  return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Expand an IELTS answer-key string into every concrete answer a student
 * could legitimately write. Handles:
 *   [OR]        top-level alternatives    "A [OR] B"          → ["a","b"]
 *   (WORD)      optional word/prefix      "(MR) SMITH"        → ["smith","mr smith"]
 *   (suffix)    optional suffix           "THOUGHT(S)"        → ["thought","thoughts"]
 *   WORD1/WORD2 either-or within a token  "THINKING/THOUGHT"  → ["thinking","thought"]
 */
export function expandAnswerKey(key: string): string[] {
  // Step 1: split on [OR] to get top-level alternatives
  const orAlternatives = key.split(/\s*\[OR\]\s*/i).map((s) => s.trim()).filter(Boolean);

  const results = new Set<string>();

  for (const alt of orAlternatives) {
    // Step 2: expand (…) optional groups
    // Collect all candidate strings with each () group either included or excluded.
    // We do this by tokenising at optional-group boundaries, then computing the power-set.
    const optExpanded = expandOptionalGroups(alt);

    for (const phrase of optExpanded) {
      // Step 3: expand / within individual tokens
      const slashExpanded = expandSlashVariants(phrase);
      for (const candidate of slashExpanded) {
        const norm = normalizeString(candidate);
        if (norm) results.add(norm);
      }
    }
  }

  return Array.from(results);
}

/**
 * Given a string that may contain (optional) groups, return all strings
 * produced by independently including or excluding each group.
 * e.g. "(MR) SMITH"       → ["SMITH", "MR SMITH"]
 *      "12(.00) A.M./AM"  → ["12 A.M./AM", "12.00 A.M./AM"]
 */
function expandOptionalGroups(s: string): string[] {
  // Split into segments: literal text and (group) captures, preserving order.
  // Each (group) capture is a toggle: the chars inside may be present or absent.
  const parts: Array<{ text: string; optional: boolean }> = [];
  const re = /\(([^)]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(s)) !== null) {
    if (m.index > last) {
      parts.push({ text: s.slice(last, m.index), optional: false });
    }
    parts.push({ text: m[1], optional: true });
    last = re.lastIndex;
  }
  if (last < s.length) {
    parts.push({ text: s.slice(last), optional: false });
  }

  // Power-set over the optional parts: 2^n combinations
  const optionalIndices = parts.map((p, i) => (p.optional ? i : -1)).filter((i) => i >= 0);
  const combos = 1 << optionalIndices.length;
  const results: string[] = [];

  for (let mask = 0; mask < combos; mask++) {
    let out = '';
    let optBit = 0;
    for (const part of parts) {
      if (!part.optional) {
        out += part.text;
      } else {
        const include = (mask >> optBit) & 1;
        if (include) out += part.text;
        optBit++;
      }
    }
    // Collapse extra spaces introduced when optional words are omitted
    results.push(out.replace(/\s+/g, ' ').trim());
  }

  return [...new Set(results)];
}

/**
 * Split a single token on `/` and propagate any leading non-alphanumeric
 * prefix (e.g. a currency symbol like `£`) from the first alternative to
 * subsequent alternatives that don't already carry it.
 * e.g. "£4.5/4.50"      → ["£4.5", "£4.50"]
 *      "A.M./AM"         → ["A.M.", "AM"]   (no non-alpha prefix)
 *      "THINKING/THOUGHT" → ["THINKING", "THOUGHT"]
 */
function expandSlashToken(token: string): string[] {
  const parts = token.split('/').filter(Boolean);
  if (parts.length === 1) return parts;

  const prefixMatch = parts[0].match(/^([^a-zA-Z0-9]+)/);
  const prefix = prefixMatch ? prefixMatch[1] : '';

  if (!prefix) return parts;

  return parts.map((p) => (p.startsWith(prefix) ? p : prefix + p));
}

/**
 * Given a whitespace-separated phrase whose individual tokens may contain
 * slashes (e.g. "THINKING/THOUGHT"), return all combinations produced by
 * choosing one side of each slash for every token.
 * e.g. "A/B C D/E" → ["A C D", "A C E", "B C D", "B C E"]
 */
function expandSlashVariants(phrase: string): string[] {
  const tokens = phrase.split(' ').filter(Boolean);
  const tokenVariants = tokens.map(expandSlashToken);

  let results: string[] = [''];
  for (const variants of tokenVariants) {
    const next: string[] = [];
    for (const prefix of results) {
      for (const v of variants) {
        next.push(prefix ? `${prefix} ${v}` : v);
      }
    }
    results = next;
  }
  return results;
}

function compareScalar(submitted: any, correct: any): boolean {
  if (typeof correct === 'string' || typeof submitted === 'string') {
    const norm = normalizeString(submitted);
    return expandAnswerKey(String(correct ?? '')).some((c) => c === norm);
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

function indexAnswers(submission: SubmitObjectiveAssignmentDto | any) {
  const bySection = new Map<string, Map<string, any>>();
  const sections = submission?.section_answers ?? submission?.answers ?? [];
  for (const sec of sections) {
    const byQuestion = new Map<string, any>();
    for (const qa of sec.answers ?? []) {
      byQuestion.set(qa.question_id, qa.answer);
    }
    bySection.set(sec.section_id, byQuestion);
  }
  return bySection;
}

export function gradeObjectiveAssignment(assignment: any, submission: SubmitObjectiveAssignmentDto | any): GradingObjectiveResult {
  const normalizedSubmission = submission?.section_answers
    ? submission
    : { ...submission, section_answers: submission?.answers ?? [] };

  const submittedIndex = indexAnswers(normalizedSubmission);

  let total = 0;
  let correctCount = 0;

  const details: GradingObjectiveResult['details'] = [];

  for (const section of assignment.sections ?? []) {
    const sectionAnswers = submittedIndex.get(section.id) ?? new Map<string, any>();

    const sectionDetail: GradingObjectiveResult['details'][number] = {
      section_id: section.id,
      section_title: section.title,
      questions: [],
    };

    const groups = section.question_groups ?? [];
    for (const group of groups) {
      for (const q of group.questions ?? []) {
        total += 1;
        const submitted = sectionAnswers.get(q.id);

        const qDetail: GradingObjectiveResult['details'][number]['questions'][number] = {
          question_id: q.id,
          correct: false,
          parts: [],
        };

        const type = q.type;
        const key = q.answer_key;
        const hasKey = key && Object.keys(key).length > 0;

        if (!hasKey) {
          sectionDetail.questions.push(qDetail);
          continue;
        }

        // gap_fill_template & form_completion
        if (type === 'gap_fill_template' || type === 'form_completion') {
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
        } else if (type === 'multiple_choice_single') {
          const expected = key?.choice ?? key?.correct_answer;
          const ok = expected !== undefined && compareScalar(submitted?.choice, expected);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'choice',
            correct: ok,
            submitted_answer: submitted?.choice,
            correct_answer: expected,
          });
        } else if (type === 'multiple_choice_multi') {
          const expected = key?.choices ?? key?.correct_answer;
          const ok =
            Array.isArray(expected) &&
            expected.length > 0 &&
            compareUnorderedArray(submitted?.choices, expected);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'choices',
            correct: ok,
            submitted_answer: submitted?.choices,
            correct_answer: expected,
          });
        } else if (type === 'true_false_not_given' || type === 'yes_no_not_given') {
          const expected = key?.choice ?? key?.correct_answer;
          const ok = expected !== undefined && compareScalar(submitted?.choice, expected);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'choice',
            correct: ok,
            submitted_answer: submitted?.choice,
            correct_answer: expected,
          });
        } else if (type === 'matching' || type === 'matching_headings' || type === 'diagram_labeling') {
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
            const ok = key?.correct_answer !== undefined && compareScalar(submitted?.choice, key?.correct_answer);
            qDetail.correct = ok;
            qDetail.parts?.push({
              key: 'choice',
              correct: ok,
              submitted_answer: submitted?.choice,
              correct_answer: key?.correct_answer,
            });
          }
        } else if (type === 'short_answer') {
          const ok = key?.correct_answer !== undefined && compareScalar(submitted?.text, key?.correct_answer);
          qDetail.correct = ok;
          qDetail.parts?.push({
            key: 'text',
            correct: ok,
            submitted_answer: submitted?.text,
            correct_answer: key?.correct_answer,
          });
        } else {
          const ok = hasKey && compareScalar(submitted, key);
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
