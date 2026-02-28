// --- Assignment Submission ---

export interface ISubquestionAnswer {
  answer: string | number | string[] | number[] | boolean;
}

export interface IQuestionAnswer {
  id: string;
  subquestion_answers: ISubquestionAnswer[];
}

export interface ISectionAnswer {
  id: string;
  question_answers: IQuestionAnswer[];
}

export interface ISubmitAssignment {
  assignment_id: string;
  submitted_by: string;
  section_answers: ISectionAnswer[];
}

// --- Writing Submission ---

export interface ICreateWritingSubmission {
  id?: string;
  assignment_id: string;
  user_id: string;
  contentOne: string;
  contentTwo: string;
}

// --- Speaking Submission ---

export interface ICreateSpeakingResponse {
  id?: string;
  assignment_id: string;
  user_id: string;
}
