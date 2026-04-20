export interface AssignmentOverview {
  id: string;              // dùng cho routing FE
  _id: string;
  title: string;
  description: string;
  skill: "reading" | "listening" | "writing" | "speaking";
  slug: string;
  created_by: string;
  is_public: boolean;
  created_at: string;
}

export interface PaginationDto {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedAssignmentResponse {
  data: AssignmentOverview[];
  pagination: PaginationMeta;
}

export interface AssignmentResponse {
  reading: AssignmentOverview[] | PaginatedAssignmentResponse;
  listening: AssignmentOverview[] | PaginatedAssignmentResponse;
  writing: AssignmentOverview[] | PaginatedAssignmentResponse;
  speaking: AssignmentOverview[] | PaginatedAssignmentResponse;
}

// =======================
// ASSIGNMENT SCHEMA V2 (READING/LISTENING)
// =======================

export type MediaKindV2 = "image" | "audio" | "file";

export interface MediaAssetV2 {
  id: string;
  kind: MediaKindV2;
  url: string;
  mime?: string;
  title?: string;
  alt?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
}

export interface StimulusTemplateBlankV2 {
  blank_id: string;
  placeholder_label?: string;
}

export interface StimulusTemplateV2 {
  format: "text";
  body: string; // placeholders like {{blank:1}}
  blanks: StimulusTemplateBlankV2[];
}

export interface StimulusV2 {
  instructions_md?: string;
  content_md?: string;
  media?: MediaAssetV2[];
  template?: StimulusTemplateV2;
}

export type QuestionTypeV2 =
  | "gap_fill_template"
  | "multiple_choice_single"
  | "multiple_choice_multi"
  | "true_false_not_given"
  | "matching"
  | "diagram_labeling"
  | "short_answer";

export type InteractionPayloadV2 = Record<string, unknown>;
export type AnswerKeyPayloadV2 = Record<string, unknown>;

export interface QuestionV2Client {
  id: string;
  order_index: number;
  type: QuestionTypeV2;
  prompt_md?: string;
  stimulus?: StimulusV2;
  interaction: InteractionPayloadV2;
  answer_key?: AnswerKeyPayloadV2; // Optional for client practice mode or as per json.txt
}

export interface QuestionV2Authoring extends QuestionV2Client {
  answer_key: AnswerKeyPayloadV2;
}

export interface QuestionGroupV2Client {
  id: string;
  order_index: number;
  title?: string;
  instructions_md?: string;
  questions: QuestionV2Client[];
  stimulus?: StimulusV2; // Added to match group-level stimulus in json.txt
}

export interface ReadingSectionMaterialV2 {
  type: "reading";
  document_md: string;
  images?: MediaAssetV2[];
}

export interface ListeningSectionMaterialV2 {
  type: "listening";
  audio: MediaAssetV2;
  transcript_md?: string;
  images?: MediaAssetV2[];
}

export type SectionMaterialV2 = ReadingSectionMaterialV2 | ListeningSectionMaterialV2;

export interface SectionV2Client {
  id: string;
  title: string;
  order_index: number;
  material: SectionMaterialV2;
  question_groups: QuestionGroupV2Client[];
}

export interface ReadingAssignmentDetail {
  id: string;
  _id: string;
  title: string;
  description: string;
  skill: "reading";
  slug: string;
  created_by: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  schema_version: number;
  sections: SectionV2Client[];
}

// Legacy-friendly reading section type for UI components
export interface ReadingSubquestion {
  id: string;
  subprompt: string;
  options: string[];
}

export interface ReadingQuestion {
  id: string;
  prompt: string;
  type: string;
  subquestions: ReadingSubquestion[];
}

export interface ReadingSection {
  id: string;
  title: string;
  material: SectionMaterialV2;
  questions: ReadingQuestion[];
}

export interface ListeningAssignmentDetail {
  id: string;
  _id: string;
  title: string;
  description: string;
  skill: "listening";
  slug: string;
  created_by: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  schema_version: number;
  sections: SectionV2Client[];
}

// =======================
// LEGACY LISTENING SECTION SHAPE (for UI components)
// =======================

export interface ListeningSubquestion {
  id: string;
  subprompt: string;
  options: string[];
}

export interface ListeningQuestion {
  id: string;
  prompt: string;
  type: string;
  subquestions: ListeningSubquestion[];
}

export interface ListeningSection {
  id: string;
  title?: string;
  questions: ListeningQuestion[];
}

export interface SubmitAssignmentV2Payload {
  assignment_id: string;
  submitted_by: string;
  section_answers: Array<{
    section_id: string;
    answers: Array<{
      question_id: string;
      answer: unknown;
    }>;
  }>;
}

export interface SubmissionResultV2 {
  _id: string; // From json.txt
  id?: string; // For compatibility
  assignment_id: string;
  submitted_by: string;
  skill: "reading" | "listening";
  score: number;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  percentage: number;
  created_at: string;
  details: Array<{
    _id?: string;
    section_id: string;
    section_title: string;
    questions: Array<{
      _id?: string;
      question_id: string;
      correct: boolean;
      parts: Array<{
        _id?: string;
        key: string;
        correct: boolean;
        submitted_answer: unknown;
        correct_answer: unknown;
      }>;
      subquestions: any[]; // From json.txt
    }>;
  }>;
}

// =======================
// WRITING ASSIGNMENT
// =======================

export interface WritingTaskDto {
  id: string;
  task_number: number; // 1, 2
  format: "academic" | "general_training";
  task_kind?: string;
  prompt_md: string;
  instructions_md?: string;
  word_limit?: {
    min?: number;
    max?: number;
    target?: number;
  };
  recommended_minutes?: number;
  stimulus?: {
    images?: MediaAssetV2[];
    data_description_md?: string;
  };
  rubric_id?: string;
  criteria_weights?: Record<string, number>;
}

export interface WritingAssignmentDetail {
  id: string;
  _id: string;
  title: string;
  description?: string;
  skill: "writing";
  slug: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  tasks: WritingTaskDto[];
}

export interface WritingSubmissionPayload {
  assignment_id: string;
  user_id: string;
  content_by_task_id: Record<string, string>; // Map task id -> essay text
}

export interface WritingSubmissionResult {
  id: string;
  assignment_id: string;
  submitted_by: string;
  skill: "writing";
  score: number;
  is_passed: boolean;
  details: any;
  created_at: string;
}

// =======================
// SPEAKING ASSIGNMENT
// =======================

export interface SpeakingPartItemDto {
  id: string;
  prompt_md: string;
  follow_up_prompts?: string[];
  order_index: number;
}

export interface SpeakingCueCardDto {
  topic_md: string;
  bullet_points: string[];
  preparation_seconds?: number;
  speaking_seconds?: number;
  explanation_md?: string;
}

export interface SpeakingPartDto {
  part_number: number; // 1, 2, 3
  items?: SpeakingPartItemDto[];
  cue_card?: SpeakingCueCardDto;
  media?: MediaAssetV2[];
}

export interface SpeakingAssignmentDetail {
  id: string;
  _id: string;
  title: string;
  description?: string;
  skill: "speaking";
  slug: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  parts: SpeakingPartDto[];
}

export interface SpeakingSubmissionPayload {
  assignment_id: string;
  user_id: string;
  // Files are handled via FormData in service
}

// =======================
// CREATE ASSIGNMENT PAYLOADS (ADMIN/TEACHER)
// =======================

export type Skill = "reading" | "listening" | "writing" | "speaking";

export interface CreateReadingOrListeningAssignmentPayload {
  created_by?: string;
  class_id?: string;
  skill: "reading" | "listening";
  slug?: string;
  title: string;
  description?: string;
  is_public: boolean;
  sections: Array<{
    id: string;
    title: string;
    order_index: number;
    material: SectionMaterialV2;
    question_groups: Array<{
      id: string;
      order_index: number;
      title?: string;
      instructions_md?: string;
      questions: QuestionV2Authoring[];
    }>;
  }>;
}

export interface CreateWritingAssignmentPayload {
  title: string;
  description?: string;
  is_public: boolean;
  tasks: WritingTaskDto[];
}

export interface CreateSpeakingAssignmentPayload {
  title: string;
  description?: string;
  is_public: boolean;
  parts: SpeakingPartDto[];
}

// =======================
// MY SUBMISSIONS (PAGINATED)
// =======================

export interface SubmissionListItem {
  submissionId: string;
  assignmentId: string;
  skill: Skill;
  createdAt: string; // ISO string
  score?: number;
  assignmentTitle?: string;
  status?: "pending" | "graded" | "failed";
}

export interface MySubmissionsResponse {
  data: SubmissionListItem[];
  pagination: PaginationMeta;
}

