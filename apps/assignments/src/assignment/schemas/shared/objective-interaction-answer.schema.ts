/**
 * Concrete shapes for objective `interaction` (UI) and `answer_key` (grading).
 * Aligns with `grading-objective.util.ts` — keep these in sync when the grader changes.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// --- Shared UI pieces --------------------------------------------------------

export class McOption {
  @ApiProperty({ description: 'Stable id (e.g. "A", "B", or "opt-1") matched in answer_key / submission' })
  id: string;

  @ApiProperty()
  label_md: string;
}

export class BlankSpec {
  @ApiProperty({ description: 'Must match blank_id in stimulus.template.blanks and answer_key.blanks keys' })
  id: string;

  @ApiPropertyOptional()
  placeholder_label?: string;

  @ApiPropertyOptional()
  max_length?: number;
}

export class MatchingPoolItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  label_md: string;
}

// --- interaction: one class per question `type` ----------------------------

/** `gap_fill_template` — blanks tied to template / form fields */
export class GapFillTemplateInteraction {
  @ApiProperty({ type: [BlankSpec] })
  blanks: BlankSpec[];
}

/** `form_completion` — same grading branch as gap fill; often table-like fields */
export class FormCompletionInteraction {
  @ApiProperty({ type: [BlankSpec] })
  blanks: BlankSpec[];
}

/** `multiple_choice_single` */
export class MultipleChoiceSingleInteraction {
  @ApiProperty({ type: [McOption] })
  options: McOption[];
}

/** `multiple_choice_multi` */
export class MultipleChoiceMultiInteraction {
  @ApiProperty({ type: [McOption] })
  options: McOption[];

  @ApiPropertyOptional({ description: 'Min number of selections (UI hint)' })
  min_select?: number;

  @ApiPropertyOptional()
  max_select?: number;
}

/** `true_false_not_given` / `yes_no_not_given` — same payload shape as single MC in the grader */
export class ScalarChoiceInteraction {
  @ApiProperty({ type: [McOption], description: 'Typically 3 options, e.g. T / F / NG' })
  options: McOption[];
}

/** `matching` / `matching_headings` / `diagram_labeling` when using key.map */
export class MatchingInteraction {
  @ApiProperty({ type: [MatchingPoolItem], description: 'e.g. statement or label ids' })
  left: MatchingPoolItem[];

  @ApiProperty({ type: [MatchingPoolItem], description: 'e.g. answers or heading letters' })
  right: MatchingPoolItem[];
}

/** `short_answer` */
export class ShortAnswerInteraction {
  @ApiPropertyOptional()
  placeholder?: string;

  @ApiPropertyOptional()
  max_length?: number;
}

/**
 * Union of all first-class interaction payloads stored per question.
 */
export type ObjectiveInteraction =
  | GapFillTemplateInteraction
  | FormCompletionInteraction
  | MultipleChoiceSingleInteraction
  | MultipleChoiceMultiInteraction
  | ScalarChoiceInteraction
  | MatchingInteraction
  | ShortAnswerInteraction;

// --- answer_key: one class per grading branch -------------------------------

export class AnswerKeyGapFillOrForm {
  @ApiProperty({ description: 'blank_id → correct string (case-insensitive trim compare)' })
  blanks: Record<string, string>;
}

export class AnswerKeyMultipleChoiceSingle {
  @ApiPropertyOptional({ description: 'Use id from McOption.id' })
  choice?: string;

  @ApiPropertyOptional({ description: 'Alternative to choice (grader accepts either)' })
  correct_answer?: string;
}

export class AnswerKeyMultipleChoiceMulti {
  @ApiPropertyOptional({ type: [String], description: 'Unordered set compare vs submission.choices' })
  choices?: string[];

  @ApiPropertyOptional({ type: [String] })
  correct_answer?: string[];
}

export class AnswerKeyMatchingMap {
  @ApiProperty({
    description: 'left_id → right_id (or label token); grader compares to submission.map',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  map: Record<string, string>;
}

export class AnswerKeyShortAnswer {
  @ApiProperty()
  correct_answer: string;
}

/**
 * Union of answer_key shapes the grader understands.
 * Rare fallback in grading-objective.util compares scalar `submitted` to `key` for unknown types.
 */
export type ObjectiveAnswerKey =
  | AnswerKeyGapFillOrForm
  | AnswerKeyMultipleChoiceSingle
  | AnswerKeyMultipleChoiceMulti
  | AnswerKeyMatchingMap
  | AnswerKeyShortAnswer;

// --- Discriminated full question (TypeScript-only contract) ------------------

type BaseObjectiveQuestion = {
  id: string;
  order_index: number;
  prompt_md?: string;
};

export type DiscriminatedObjectiveQuestion =
  | (BaseObjectiveQuestion & {
      type: 'gap_fill_template';
      interaction: GapFillTemplateInteraction;
      answer_key: AnswerKeyGapFillOrForm;
    })
  | (BaseObjectiveQuestion & {
      type: 'form_completion';
      interaction: FormCompletionInteraction;
      answer_key: AnswerKeyGapFillOrForm;
    })
  | (BaseObjectiveQuestion & {
      type: 'multiple_choice_single';
      interaction: MultipleChoiceSingleInteraction;
      answer_key: AnswerKeyMultipleChoiceSingle;
    })
  | (BaseObjectiveQuestion & {
      type: 'multiple_choice_multi';
      interaction: MultipleChoiceMultiInteraction;
      answer_key: AnswerKeyMultipleChoiceMulti;
    })
  | (BaseObjectiveQuestion & {
      type: 'true_false_not_given' | 'yes_no_not_given';
      interaction: ScalarChoiceInteraction;
      answer_key: AnswerKeyMultipleChoiceSingle;
    })
  | (BaseObjectiveQuestion & {
      type: 'matching' | 'matching_headings' | 'diagram_labeling';
      interaction: MatchingInteraction;
      answer_key: AnswerKeyMatchingMap | AnswerKeyMultipleChoiceSingle;
    })
  | (BaseObjectiveQuestion & {
      type: 'short_answer';
      interaction: ShortAnswerInteraction;
      answer_key: AnswerKeyShortAnswer;
    });
