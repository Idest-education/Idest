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
  stimulus: StimulusV2;
  interaction: InteractionPayloadV2;
  // NOTE: answer_key intentionally not present on client exam fetch.
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
  sections: SectionV2Client[];
}

export interface ListeningAssignmentDetail {
  id: string;
  _id?: string;
  title: string;
  description: string;
  skill: "listening";
  slug?: string;
  created_by?: string;
  is_public?: boolean;
  created_at: string;
  sections: SectionV2Client[];
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
  id: string;
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
    section_id: string;
    section_title: string;
    questions: Array<{
      question_id: string;
      correct: boolean;
      parts?: Array<{
        key: string;
        correct: boolean;
        submitted_answer: unknown;
        correct_answer: unknown;
      }>;
    }>;
  }>;
}

// =======================
// WRITING ASSIGNMENT DETAIL
// =======================

export interface WritingAssignmentDetail {
  id: string;
  _id?: string;
  title: string;
  description?: string;
  skill: "writing";
  is_public?: boolean;

  // Task 1
  taskone: string;
  img?: string;
  imgDescription?: string;

  // Task 2
  tasktwo: string;

  created_at?: string;
}

export interface WritingSubmissionPayload {
  assignment_id: string;
  user_id: string;
  contentOne: string; // Task 1 essay
  contentTwo: string; // Task 2 essay
}

export interface WritingSubmissionResult {
  id: string;
  assignment_id: string;
  user_id: string;
  skill: "writing";

  contentOne: string;
  contentTwo: string;

  status?: "pending" | "graded" | "failed";
  score?: number;            // Overall writing score (when graded)
  feedback?: string;         // Feedback (when graded)

  created_at: string;
}

// =======================
// SPEAKING ASSIGNMENT DETAIL
// =======================
export interface SpeakingQuestion {
  id: string;
  prompt: string;
  order_index: number;
}

export interface SpeakingPart {
  part_number: number; // 1, 2, 3
  questions: SpeakingQuestion[];
}

export interface SpeakingAssignmentDetail {
  id: string;
  title: string;
  parts: SpeakingPart[];
  created_at: string;
  skill: "speaking";
}

export interface SpeakingSubmissionPayload {
  assignment_id: string;
  user_id: string;
  audioOne: File;
  audioTwo: File;
  audioThree: File;
}

export interface SpeakingSubmissionResult {
  id: string;
  assignment_id: string;
  user_id: string;

  audio_url: string;

  transcriptOne?: string;
  transcriptTwo?: string;
  transcriptThree?: string;

  status?: "pending" | "graded" | "failed";
  score?: number;
  feedback?: string;
}


// (listening v1 detail/payload/result removed; use v2 types above)

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
    id: string; // uuid
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
  taskone: string;
  tasktwo: string;
  img?: string;
  imgDescription?: string;
}

export interface CreateSpeakingAssignmentPayload {
  title: string;
  parts: Array<{
    part_number: 1 | 2 | 3;
    questions: Array<{
      prompt: string;
      order_index: number;
    }>;
  }>;
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

