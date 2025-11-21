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

export interface AssignmentResponse {
  reading: AssignmentOverview[];
  listening: AssignmentOverview[];
  writing: AssignmentOverview[];
  speaking: AssignmentOverview[];
}

// =======================
// READING ASSIGNMENT DETAIL
// =======================
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
  sections: ReadingSection[];
}

export interface ReadingSection {
  id: string;
  title: string;
  order_index: number;
  reading_material: {
    id: string;
    document: string;
    image_url?: string;
  };
  questions: ReadingQuestion[];
}

export interface ReadingQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "fill_blank" | "matching";
  prompt: string;
  subquestions: ReadingSubquestion[];
}

export interface ReadingSubquestion {
  id: string;
  subprompt: string;
  options: string[];
  answer: string | number;
}

export interface ReadingSubmissionPayload {
  assignment_id: string;
  submitted_by: string;
  section_answers: {
    id: string; // section id
    question_answers: {
      id: string; // question id
      subquestion_answers: {
        answer: string | number;
      }[];
    }[];
  }[];
}

export interface ReadingSubmissionResult {
  id: string;
  assignment_id: string;
  submitted_by: string;
  skill: "reading";
  score: number;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  percentage: number;
  created_at: string;
  details: ReadingSubmissionSectionResult[];
}

export interface ReadingSubmissionSectionResult {
  section_id: string;
  section_title: string;
  questions: ReadingSubmissionQuestionResult[];
}

export interface ReadingSubmissionQuestionResult {
  question_id: string;
  subquestions: {
    id: string;
    correct: boolean;
    submitted_answer?: number;
    correct_answer: string | number;
  }[];
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

  score: number;            // Overall writing score
  feedback: string;         // Task 1 + Task 2 feedback (plain text)

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

  transcriptOne: string;
  transcriptTwo: string;
  transcriptThree: string;

  score: number;
  feedback: string;
}


// =======================
// SPEAKING ASSIGNMENT DETAIL
// =======================
export interface ListeningSubquestion {
  id: string;
  subprompt: string;
  options: string[];
  answer: string; // correct answer (server-side)
}

export interface ListeningQuestion {
  id: string;
  type: "multiple_choice" | "fill_blank" | "true_false";
  prompt: string;
  subquestions: ListeningSubquestion[];
}

export interface ListeningMaterial {
  id: string;
  audio_url: string;
  transcript: string;
}

export interface ListeningSection {
  id: string;
  title: string;
  order_index: number;
  listening_material: ListeningMaterial;
  questions: ListeningQuestion[];
}

export interface ListeningAssignmentDetail {
  id: string;
  title: string;
  description: string;
  sections: ListeningSection[];
  skill: "listening";
  created_at: string;
}

export interface ListeningSubmissionPayload {
  assignment_id: string;
  submitted_by: string;
  section_answers: {
    id: string;
    question_answers: {
      id: string;
      subquestion_answers: { answer: string }[];
    }[];
  }[];
}

export interface ListeningSubmissionResultDetail {
  section_id: string;
  section_title: string;
  questions: {
    question_id: string;
    subquestions: {
      correct: boolean;
      submitted_answer: string;
      correct_answer: string;
      id: string;
    }[];
  }[];
}

export interface ListeningSubmissionResult {
  id: string;
  assignment_id: string;
  submitted_by: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  percentage: number;
  details: ListeningSubmissionResultDetail[];
}

